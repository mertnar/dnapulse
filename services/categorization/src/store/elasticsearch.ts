import { Client } from '@elastic/elasticsearch';
import { Item, AppliedLabel } from '../model';
import { Logger } from 'pino';

export interface ElasticsearchStoreOptions {
  node: string;
  index: string;
  logger: Logger;
}

export interface CategorizedItemDocument {
  item_id: string;
  tenant_id: string;
  type: string;
  ts: string;
  labels: Array<{
    kind: string;
    name: string;
    score?: number;
    meta?: Record<string, any>;
  }>;
  indexed_at: string;
}

export class ElasticsearchStore {
  private client: Client;
  private index: string;
  private logger: Logger;

  constructor(options: ElasticsearchStoreOptions) {
    this.client = new Client({ node: options.node });
    this.index = options.index;
    this.logger = options.logger;
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      await this.client.ping();

      // Create index if it doesn't exist
      await this.ensureIndex();

      this.logger.info('Connected to Elasticsearch', { index: this.index });
    } catch (error) {
      this.logger.error('Failed to connect to Elasticsearch', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Elasticsearch client doesn't need explicit disconnect
    this.logger.info('Disconnected from Elasticsearch');
  }

  private async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.index });

    if (!exists) {
      await this.client.indices.create({
        index: this.index,
        body: {
          mappings: {
            properties: {
              item_id: { type: 'keyword' },
              tenant_id: { type: 'keyword' },
              type: { type: 'keyword' },
              ts: { type: 'date' },
              labels: {
                type: 'nested',
                properties: {
                  kind: { type: 'keyword' },
                  name: { type: 'keyword' },
                  score: { type: 'float' },
                  meta: { type: 'object' },
                },
              },
              indexed_at: { type: 'date' },
            },
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
        },
      });

      this.logger.info('Created Elasticsearch index', { index: this.index });
    }
  }

  async indexItem(item: Item, labels: AppliedLabel[]): Promise<void> {
    try {
      const doc: CategorizedItemDocument = {
        item_id: item.id,
        tenant_id: item.tenant_id,
        type: item.type,
        ts: item.ts,
        labels: labels.map((label) => ({
          kind: label.kind,
          name: label.name,
          ...(label.score !== undefined && { score: label.score }),
          ...(label.meta && { meta: label.meta }),
        })),
        indexed_at: new Date().toISOString(),
      };

      await this.client.index({
        index: this.index,
        id: item.id,
        body: doc,
      });

      this.logger.debug('Item indexed', { itemId: item.id, labelCount: labels.length });
    } catch (error) {
      this.logger.error('Failed to index item', { error, itemId: item.id });
      throw error;
    }
  }

  async searchByLabels(
    labelNames: string[],
    tenantId?: string,
    limit = 100
  ): Promise<CategorizedItemDocument[]> {
    try {
      const query: any = {
        bool: {
          must: [
            {
              nested: {
                path: 'labels',
                query: {
                  terms: {
                    'labels.name': labelNames,
                  },
                },
              },
            },
          ],
        },
      };

      if (tenantId) {
        query.bool.filter = [{ term: { tenant_id: tenantId } }];
      }

      const response = await this.client.search({
        index: this.index,
        body: {
          query,
          size: limit,
          sort: [{ ts: { order: 'desc' } }],
        },
      });

      return (response as any).hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      this.logger.error('Failed to search by labels', { error, labelNames });
      throw error;
    }
  }

  async searchByItemId(itemId: string): Promise<CategorizedItemDocument | null> {
    try {
      const response = await this.client.get({
        index: this.index,
        id: itemId,
      });

      return (response as any)._source;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      this.logger.error('Failed to search by item ID', { error, itemId });
      throw error;
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.index,
        id: itemId,
      });

      this.logger.debug('Item deleted from index', { itemId });
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Item not found, that's ok
        return;
      }
      this.logger.error('Failed to delete item from index', { error, itemId });
      throw error;
    }
  }
}
