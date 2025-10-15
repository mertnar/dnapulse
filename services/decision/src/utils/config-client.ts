import axios from 'axios';
import EventSource from 'eventsource';
import * as yaml from 'js-yaml';
import { PolicyConfig } from '../types/policy';

export class ConfigClient {
  private configServiceUrl: string;
  private scope: string;
  private eventSource?: EventSource;

  constructor(configServiceUrl: string, scope: string = 'decision') {
    this.configServiceUrl = configServiceUrl;
    this.scope = scope;
  }

  /**
   * Fetch configuration from Config Service
   */
  async fetchConfig(scope?: string): Promise<PolicyConfig> {
    const targetScope = scope || this.scope;
    try {
      const response = await axios.get(`${this.configServiceUrl}/v1/config/${targetScope}`, {
        headers: {
          Accept: 'application/x-yaml',
        },
      });

      const config = yaml.load(response.data) as PolicyConfig;
      return config;
    } catch (error) {
      console.error(`Failed to fetch config for scope ${targetScope}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to configuration updates via SSE
   */
  subscribeToUpdates(
    onUpdate: (config: PolicyConfig) => void,
    onError?: (error: Error) => void
  ): () => void {
    const streamUrl = `${this.configServiceUrl}/v1/stream`;

    this.eventSource = new EventSource(streamUrl);

    // Handle connection
    this.eventSource.addEventListener('connected', (event: any) => {
      console.log('Connected to config stream:', event.data);
    });

    // Handle config updates
    this.eventSource.addEventListener('config:update', async (event: any) => {
      try {
        const data = JSON.parse(event.data);

        // Only reload if it's our scope
        if (data.scope === this.scope) {
          console.log(`Config update detected for scope: ${this.scope}, etag: ${data.etag}`);
          const config = await this.fetchConfig();
          onUpdate(config);
        }
      } catch (error) {
        console.error('Error handling config update:', error);
        if (onError) {
          onError(error as Error);
        }
      }
    });

    // Handle heartbeat
    this.eventSource.addEventListener('heartbeat', (event: any) => {
      console.debug('Config stream heartbeat:', event.data);
    });

    // Handle errors
    this.eventSource.onerror = (error: any) => {
      console.error('Config stream error:', error);
      if (onError) {
        onError(new Error('SSE connection error'));
      }
    };

    // Return unsubscribe function
    return () => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = undefined;
      }
    };
  }

  /**
   * Close SSE connection
   */
  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }
}
