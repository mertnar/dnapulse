import { Db, Collection } from 'mongodb';
import { FastifyLoggerInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import { SchemaService } from './schema.service';
import { config } from '../config';

export interface ConfigDocument {
  scope: string;
  yaml: string;
  etag: string;
  updated_at: Date;
  created_at: Date;
}

export interface ConfigUpdateEvent {
  scope: string;
  etag: string;
  timestamp: Date;
}

export class ConfigService {
  private collection: Collection<ConfigDocument>;
  private cache: Map<string, { config: any; etag: string; timestamp: number }> = new Map();
  private subscribers: Set<(event: ConfigUpdateEvent) => void> = new Set();

  constructor(
    db: Db,
    private schemaService: SchemaService,
    private logger: FastifyLoggerInstance
  ) {
    this.collection = db.collection(config.collectionName);
  }

  async initializeDefaultConfigs(): Promise<void> {
    try {
      // Check if configs already exist
      const count = await this.collection.countDocuments();
      if (count > 0) {
        this.logger.info('Configs already initialized');
        return;
      }

      // Initialize default configs from files
      const defaultConfigs = [
        { scope: 'processing', file: 'processing.rules.yaml' },
        { scope: 'decision', file: 'decision.policies.yaml' },
        { scope: 'categorization', file: 'categorization.yaml' },
      ];

      for (const { scope, file } of defaultConfigs) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const configPath = path.join(process.cwd(), '..', '..', 'configs', file);

          if (fs.existsSync(configPath)) {
            const yamlContent = fs.readFileSync(configPath, 'utf8');
            await this.upsertConfig(scope, yamlContent, true);
            this.logger.info(`Initialized default config for scope: ${scope}`);
          }
        } catch (error) {
          this.logger.warn(`Could not initialize default config for ${scope}: ${error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to initialize default configs: ${error}`);
    }
  }

  async getConfig(scope: string): Promise<{ yaml: string; etag: string } | null> {
    try {
      // Check cache first
      const cached = this.cache.get(scope);
      if (cached && Date.now() - cached.timestamp < config.cacheTtl * 1000) {
        return { yaml: yaml.dump(cached.config), etag: cached.etag };
      }

      const doc = await this.collection.findOne({ scope });
      if (!doc) {
        return null;
      }

      // Update cache
      const parsedConfig = yaml.load(doc.yaml) as any;
      this.cache.set(scope, {
        config: parsedConfig,
        etag: doc.etag,
        timestamp: Date.now(),
      });

      return { yaml: doc.yaml, etag: doc.etag };
    } catch (error) {
      this.logger.error(`Failed to get config for scope ${scope}: ${error}`);
      throw new Error(`Failed to get config: ${error}`);
    }
  }

  async upsertConfig(
    scope: string,
    yamlContent: string,
    skipValidation = false
  ): Promise<{ etag: string }> {
    try {
      // Validate YAML syntax
      const parsedConfig = yaml.load(yamlContent) as any;
      if (parsedConfig === undefined) {
        throw new Error('Invalid YAML content');
      }

      // Validate against schema if available and not skipping
      if (!skipValidation) {
        await this.schemaService.validateConfig(scope, parsedConfig);
      }

      // Check size limit
      if (yamlContent.length > config.maxConfigSize) {
        throw new Error(`Config size exceeds limit of ${config.maxConfigSize} bytes`);
      }

      const etag = uuidv4();
      const now = new Date();

      const doc: ConfigDocument = {
        scope,
        yaml: yamlContent,
        etag,
        updated_at: now,
        created_at: now,
      };

      // Upsert document
      await this.collection.replaceOne({ scope }, doc, { upsert: true });

      // Update cache
      this.cache.set(scope, {
        config: parsedConfig,
        etag,
        timestamp: Date.now(),
      });

      // Notify subscribers
      const event: ConfigUpdateEvent = {
        scope,
        etag,
        timestamp: now,
      };
      this.notifySubscribers(event);

      this.logger.info(`Config updated for scope: ${scope}, etag: ${etag}`);

      return { etag };
    } catch (error) {
      this.logger.error(`Failed to upsert config for scope ${scope}: ${error}`);
      throw error;
    }
  }

  subscribeToUpdates(callback: (event: ConfigUpdateEvent) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(event: ConfigUpdateEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        this.logger.error(`Error notifying subscriber: ${error}`);
      }
    });
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  async listScopes(): Promise<string[]> {
    try {
      const scopes = await this.collection.distinct('scope');
      return scopes.sort();
    } catch (error) {
      this.logger.error(`Failed to list scopes: ${error}`);
      throw new Error(`Failed to list scopes: ${error}`);
    }
  }

  async deleteConfig(scope: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ scope });

      if (result.deletedCount > 0) {
        // Remove from cache
        this.cache.delete(scope);

        // Notify subscribers
        const event: ConfigUpdateEvent = {
          scope,
          etag: '',
          timestamp: new Date(),
        };
        this.notifySubscribers(event);

        this.logger.info(`Config deleted for scope: ${scope}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to delete config for scope ${scope}: ${error}`);
      throw new Error(`Failed to delete config: ${error}`);
    }
  }
}
