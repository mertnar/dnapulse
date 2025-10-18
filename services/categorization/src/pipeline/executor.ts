import { Item, AppliedLabel, CategorizationConfig, Cardinality } from '../model';
import { LabelerRegistry } from '../labelers';
import { Parser } from 'expr-eval';
import { Logger } from 'pino';
import { CategorizedItemsStore } from '../store/categorized-items';
import { ElasticsearchLogger } from '../observability/elasticsearch-logger';
import { KafkaEventPublisher } from '../observability/kafka-publisher';

export interface PipelineExecutorOptions {
  registry: LabelerRegistry;
  logger: Logger;
  categorizedItemsStore?: CategorizedItemsStore;
  elasticsearchLogger?: ElasticsearchLogger;
  kafkaEventPublisher?: KafkaEventPublisher;
}

export class PipelineExecutor {
  private registry: LabelerRegistry;
  private logger: Logger;
  private config?: CategorizationConfig;
  private categorizedItemsStore?: CategorizedItemsStore;
  private elasticsearchLogger?: ElasticsearchLogger;
  private kafkaEventPublisher?: KafkaEventPublisher;

  constructor(options: PipelineExecutorOptions) {
    this.registry = options.registry;
    this.logger = options.logger;
    if (options.categorizedItemsStore) {
      this.categorizedItemsStore = options.categorizedItemsStore;
    }
    if (options.elasticsearchLogger) {
      this.elasticsearchLogger = options.elasticsearchLogger;
    }
    if (options.kafkaEventPublisher) {
      this.kafkaEventPublisher = options.kafkaEventPublisher;
    }
  }

  setConfig(config: CategorizationConfig): void {
    this.config = config;
    this.logger.info('Pipeline configuration updated', {
      version: config.version,
      cardinality: config.cardinality,
      pipelineCount: config.pipelines.length,
    });
  }

  async execute(item: Item): Promise<AppliedLabel[]> {
    if (!this.config) {
      throw new Error('Pipeline configuration not set');
    }

    const startTime = Date.now();
    const eventId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if item matches target selector
    if (!this.matchesTarget(item)) {
      this.logger.debug('Item does not match target selector', { itemId: item.id });
      return [];
    }

    const allLabels: AppliedLabel[] = [];

    // Execute enabled pipelines in priority order
    const enabledPipelines = this.config.pipelines
      .filter((p) => p.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const pipeline of enabledPipelines) {
      try {
        const labeler = this.registry.create(pipeline.labeler, pipeline.args);
        const labels = await labeler.apply(item, pipeline.args);

        // Add pipeline name to labels
        const labeledResults = labels.map((label) => ({
          ...label,
          meta: {
            ...label.meta,
            pipeline: pipeline.name,
          },
        }));

        allLabels.push(...labeledResults);

        this.logger.debug('Pipeline executed', {
          itemId: item.id,
          pipeline: pipeline.name,
          labelCount: labels.length,
        });
      } catch (error) {
        this.logger.error('Pipeline execution failed', {
          itemId: item.id,
          pipeline: pipeline.name,
          error,
        });
        // Continue with other pipelines
      }
    }

    // Apply cardinality rules
    const finalLabels = this.applyCardinality(allLabels, this.config.cardinality);

    // Apply default label if no labels found
    if (finalLabels.length === 0 && this.config.default_label) {
      finalLabels.push({
        kind: this.config.label_kind,
        name: this.config.default_label,
        score: 0.1,
        meta: { source: 'default' },
      });
    }

    this.logger.debug('Pipeline execution completed', {
      itemId: item.id,
      totalLabels: allLabels.length,
      finalLabels: finalLabels.length,
      cardinality: this.config.cardinality,
    });

    const duration = Date.now() - startTime;

    // Store categorized item in MongoDB
    if (this.categorizedItemsStore && finalLabels.length > 0) {
      try {
        await this.categorizedItemsStore.storeCategorizedItem({
          item_id: item.id,
          tenant_id: item.tenant_id || 'default',
          original_item: item,
          labels: finalLabels,
          categorization_time: new Date(),
          duration_ms: duration,
          status: 'success',
          created_at: new Date(),
          updated_at: new Date(),
        });
      } catch (error) {
        this.logger.error('Failed to store categorized item', {
          itemId: item.id,
          error,
        });
      }
    }

    // Log to Elasticsearch
    if (this.elasticsearchLogger && finalLabels.length > 0) {
      try {
        await this.elasticsearchLogger.logCategorizationSuccess(
          eventId,
          item.id,
          item.tenant_id || 'default',
          item,
          finalLabels,
          duration
        );
      } catch (error) {
        this.logger.error('Failed to log categorization event to Elasticsearch', {
          itemId: item.id,
          error,
        });
      }
    }

    // Publish to Kafka
    if (this.kafkaEventPublisher && finalLabels.length > 0) {
      try {
        await this.kafkaEventPublisher.publishCategorizationSuccess(
          eventId,
          item.id,
          item.tenant_id || 'default',
          item,
          finalLabels,
          duration
        );
      } catch (error) {
        this.logger.error('Failed to publish categorization event to Kafka', {
          itemId: item.id,
          error,
        });
      }
    }

    return finalLabels;
  }

  private matchesTarget(item: Item): boolean {
    if (!this.config?.targets) {
      return true; // No target restrictions
    }

    // Check item types
    if (this.config.targets.item_types && !this.config.targets.item_types.includes(item.type)) {
      return false;
    }

    // Check selector expression
    if (this.config.targets.selector) {
      try {
        const context = {
          payload: item.payload,
          attributes: item.attributes,
          type: item.type,
          tenant_id: item.tenant_id,
          id: item.id,
          ts: item.ts,
        };

        const parser = new Parser();
        const result = parser.evaluate(this.config.targets.selector, context);
        return Boolean(result);
      } catch (error) {
        this.logger.warn('Target selector evaluation failed', {
          itemId: item.id,
          selector: this.config.targets.selector,
          error,
        });
        return false;
      }
    }

    return true;
  }

  private applyCardinality(labels: AppliedLabel[], cardinality: Cardinality): AppliedLabel[] {
    switch (cardinality) {
      case 'one_to_one':
        return this.applyOneToOne(labels);

      case 'one_to_many':
        return this.applyOneToMany(labels);

      case 'many_to_one':
        return this.applyManyToOne(labels);

      case 'many_to_many':
        return this.applyManyToMany(labels);

      default:
        this.logger.warn('Unknown cardinality', { cardinality });
        return labels;
    }
  }

  private applyOneToOne(labels: AppliedLabel[]): AppliedLabel[] {
    // Keep only the highest scoring label per kind
    const kindGroups = new Map<string, AppliedLabel>();

    for (const label of labels) {
      const existing = kindGroups.get(label.kind);
      if (!existing || (label.score || 0) > (existing.score || 0)) {
        kindGroups.set(label.kind, label);
      }
    }

    return Array.from(kindGroups.values());
  }

  private applyOneToMany(labels: AppliedLabel[]): AppliedLabel[] {
    // Remove duplicates by label name, keep highest score
    const nameGroups = new Map<string, AppliedLabel>();

    for (const label of labels) {
      const existing = nameGroups.get(label.name);
      if (!existing || (label.score || 0) > (existing.score || 0)) {
        nameGroups.set(label.name, label);
      }
    }

    return Array.from(nameGroups.values());
  }

  private applyManyToOne(labels: AppliedLabel[]): AppliedLabel[] {
    // No special processing needed - just return all labels
    return labels;
  }

  private applyManyToMany(labels: AppliedLabel[]): AppliedLabel[] {
    // No special processing needed - just return all labels
    return labels;
  }
}
