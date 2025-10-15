import * as yaml from 'js-yaml';
import pino from 'pino';
import { ConfigClient } from './config-client';
import { RulesEngine } from './rules-engine';
import { CategorizationConfig } from './types';
import { configReloads, activeRules, sseConnectionStatus } from './metrics';

export class ConfigManager {
  private configClient: ConfigClient;
  private rulesEngine: RulesEngine;
  private logger: pino.Logger;
  private configScope: string;
  private sseUrl: string;
  private currentEtag?: string;
  private sseConnection: any;

  constructor(
    configUrl: string,
    configScope: string,
    sseUrl: string,
    rulesEngine: RulesEngine,
    logger: pino.Logger
  ) {
    this.configClient = new ConfigClient(configUrl);
    this.rulesEngine = rulesEngine;
    this.logger = logger;
    this.configScope = configScope;
    this.sseUrl = sseUrl;
  }

  async loadInitialConfig(): Promise<void> {
    try {
      this.logger.info(`Loading initial config for scope: ${this.configScope}`);
      await this.loadConfig();
      this.logger.info('Initial config loaded successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to load initial config');
      throw error;
    }
  }

  async loadConfig(): Promise<void> {
    try {
      const result = await this.configClient.load(this.configScope, this.currentEtag);

      if (result.status === 304) {
        this.logger.debug('Config not modified, skipping reload');
        return;
      }

      if (result.status !== 200) {
        throw new Error(`Config load failed with status: ${result.status}`);
      }

      // Parse YAML config
      const config = yaml.load(result.yaml) as CategorizationConfig;

      // Validate config
      if (!config.rules || !Array.isArray(config.rules)) {
        throw new Error('Invalid config: rules array is required');
      }

      // Load rules into engine
      this.rulesEngine.loadRules(config);

      // Update metrics
      activeRules.set(this.rulesEngine.getRuleCount());
      configReloads.inc();

      // Update etag
      this.currentEtag = result.etag;

      this.logger.info(
        {
          rulesLoaded: this.rulesEngine.getRuleCount(),
          version: config.metadata?.version,
          updatedAt: config.metadata?.updated_at,
        },
        'Config reloaded successfully'
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to load config');
      throw error;
    }
  }

  startHotReload(): void {
    if (this.sseConnection) {
      this.logger.warn('SSE connection already active');
      return;
    }

    this.logger.info('Starting config hot reload via SSE');

    this.sseConnection = this.configClient.watchSSE(this.sseUrl, (scope: string, etag: string) => {
      if (scope === this.configScope && etag !== this.currentEtag) {
        this.logger.info({ scope, etag }, 'Config update detected, reloading...');
        this.loadConfig().catch((error) => {
          this.logger.error({ error }, 'Failed to reload config on update');
        });
      }
    });

    if (this.sseConnection) {
      this.sseConnection.onopen = () => {
        this.logger.info('SSE connection established');
        sseConnectionStatus.set(1);
      };

      this.sseConnection.onerror = (error: Event) => {
        this.logger.error({ error }, 'SSE connection error');
        sseConnectionStatus.set(0);
      };
    }
  }

  stopHotReload(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = undefined;
      sseConnectionStatus.set(0);
      this.logger.info('SSE connection closed');
    }
  }

  getCurrentEtag(): string | undefined {
    return this.currentEtag;
  }

  getRuleCount(): number {
    return this.rulesEngine.getRuleCount();
  }
}
