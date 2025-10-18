import EventSource from 'eventsource';
import * as yaml from 'js-yaml';
import { CategorizationConfig } from '../model';
import { Logger } from 'pino';

export interface ConfigClientOptions {
  baseUrl: string;
  scope: string;
  timeout?: number;
  logger: Logger;
}

export class ConfigClient {
  private baseUrl: string;
  private scope: string;
  private timeout: number;
  private logger: Logger;
  private eventSource?: EventSource | undefined;

  constructor(options: ConfigClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.scope = options.scope;
    this.timeout = options.timeout || 30000;
    this.logger = options.logger;
  }

  async loadConfig(): Promise<CategorizationConfig> {
    const url = `${this.baseUrl}/v1/config/${this.scope}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/x-yaml, application/yaml, text/yaml',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Config service returned ${response.status}: ${response.statusText}`);
      }

      const textContent = await response.text();
      const config = yaml.load(textContent) as CategorizationConfig;

      this.logger.info('Configuration loaded', {
        version: config.version,
        cardinality: config.cardinality,
        labelKind: config.label_kind,
        pipelineCount: config.pipelines?.length || 0,
      });

      return config;
    } catch (error) {
      this.logger.error('Failed to load configuration', { error, url });
      throw error;
    }
  }

  watchConfig(onUpdate: (config: CategorizationConfig) => void): void {
    const url = `${this.baseUrl}/v1/stream`;

    this.logger.info('Starting SSE connection', { url });

    // Use global EventSource for better testability
    const EventSourceConstructor = (global as any).EventSource || EventSource;
    this.eventSource = new EventSourceConstructor(url);

    if (this.eventSource) {
      this.eventSource.onopen = () => {
        this.logger.info('SSE connection established');
      };

      this.eventSource.onmessage = async (event: any) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'config:update' && data.scope === this.scope) {
            this.logger.info('Configuration update detected', {
              scope: data.scope,
              etag: data.etag,
            });

            const config = await this.loadConfig();
            onUpdate(config);
          }
        } catch (error) {
          this.logger.error('Failed to process SSE message', { error, data: event.data });
        }
      };

      this.eventSource.onerror = (error: any) => {
        this.logger.error('SSE connection error', { error });

        // Reconnect after delay
        setTimeout(() => {
          const CLOSED = (global as any).EventSource?.CLOSED || EventSource.CLOSED || 2;
          if (this.eventSource?.readyState === CLOSED) {
            this.logger.info('Reconnecting SSE...');
            this.watchConfig(onUpdate);
          }
        }, 5000);
      };
    }
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
      this.logger.info('SSE connection closed');
    }
  }
}
