import { Client } from '@elastic/elasticsearch';
import pino from 'pino';

export interface ServiceEventLog {
  '@timestamp': string;
  service: string;
  event_type: string;
  event_id: string;
  level: string;
  message: string;
  source?: any;
  payload?: any;
  attributes?: any;
  duration_ms?: number;
  status?: string;
  error?: string;
}

export class ServiceLogger {
  private client: Client;
  private logger: pino.Logger;

  constructor(
    private elasticsearchUrl: string,
    private index: string,
    logger?: pino.Logger
  ) {
    this.logger = logger || pino({ level: 'info' });

    this.client = new Client({
      node: this.elasticsearchUrl,
    });
  }

  async logEvent(event: ServiceEventLog): Promise<void> {
    try {
      await this.client.index({
        index: this.index,
        body: event,
      });

      this.logger.debug('Service event logged to Elasticsearch', {
        event_id: event.event_id,
        event_type: event.event_type,
      });
    } catch (error) {
      this.logger.error('Failed to log service event to Elasticsearch', {
        event_id: event.event_id,
        error,
      });
      throw error;
    }
  }

  async logCategorizationEvent(
    eventId: string,
    item: any,
    labels: any[],
    status: string,
    duration: number,
    error?: Error
  ): Promise<void> {
    const event: ServiceEventLog = {
      '@timestamp': new Date().toISOString(),
      service: 'categorization',
      event_type: 'categorization',
      event_id: eventId,
      level: error ? 'error' : 'info',
      message: error
        ? `Failed to categorize item ${eventId}: ${error.message}`
        : `Item categorized: ${eventId}`,
      source: item.source,
      payload: {
        item: item,
        labels: labels,
        label_count: labels.length,
      },
      status: status,
      duration_ms: duration,
    };

    if (error) {
      event.error = error.message;
    }

    await this.logEvent(event);
  }

  async logConfigUpdateEvent(scope: string, etag: string): Promise<void> {
    const event: ServiceEventLog = {
      '@timestamp': new Date().toISOString(),
      service: 'categorization',
      event_type: 'config_update',
      event_id: `config_${scope}_${etag}`,
      level: 'info',
      message: `Configuration updated for scope: ${scope}`,
      attributes: {
        scope: scope,
        etag: etag,
      },
      status: 'success',
    };

    await this.logEvent(event);
  }

  async logHealthCheckEvent(status: string, duration: number): Promise<void> {
    const event: ServiceEventLog = {
      '@timestamp': new Date().toISOString(),
      service: 'categorization',
      event_type: 'health_check',
      event_id: `health_${Date.now()}`,
      level: 'info',
      message: `Health check: ${status}`,
      status: status,
      duration_ms: duration,
    };

    await this.logEvent(event);
  }
}
