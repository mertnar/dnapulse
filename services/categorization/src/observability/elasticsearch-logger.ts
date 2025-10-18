import { Client } from '@elastic/elasticsearch';
import pino from 'pino';

export interface CategorizationEvent {
  event_id: string;
  service: string;
  event_type: string;
  timestamp: Date;
  item_id: string;
  tenant_id: string;
  original_item: any;
  labels: any[];
  duration_ms: number;
  status: string;
  error?: string;
  level: string;
  message: string;
}

export class ElasticsearchLogger {
  private client: Client;
  private index: string;
  private serviceName: string;
  private logger: pino.Logger;

  constructor(elasticsearchNode: string, index: string, serviceName: string, logger?: pino.Logger) {
    this.logger = logger || pino({ level: 'info' });
    this.index = index;
    this.serviceName = serviceName;

    this.client = new Client({
      node: elasticsearchNode,
      requestTimeout: 30000,
      maxRetries: 3,
    });
  }

  async logCategorizationEvent(event: CategorizationEvent): Promise<void> {
    try {
      const logEntry = {
        '@timestamp': event.timestamp,
        service: this.serviceName,
        event_type: event.event_type,
        event_id: event.event_id,
        item_id: event.item_id,
        tenant_id: event.tenant_id,
        payload: {
          original_item: event.original_item,
          labels: event.labels,
        },
        status: event.status,
        duration_ms: event.duration_ms,
        level: event.level,
        message: event.message,
        ...(event.error && { error: event.error }),
      };

      await this.client.index({
        index: this.index,
        id: event.event_id,
        body: logEntry,
        refresh: 'wait_for',
      });

      this.logger.debug('Categorization event logged to Elasticsearch', {
        event_id: event.event_id,
        item_id: event.item_id,
      });
    } catch (error) {
      this.logger.error('Failed to log categorization event to Elasticsearch', {
        event_id: event.event_id,
        error,
      });
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  async logCategorizationSuccess(
    eventId: string,
    itemId: string,
    tenantId: string,
    originalItem: any,
    labels: any[],
    durationMs: number
  ): Promise<void> {
    const event: CategorizationEvent = {
      event_id: eventId,
      service: this.serviceName,
      event_type: 'categorization',
      timestamp: new Date(),
      item_id: itemId,
      tenant_id: tenantId,
      original_item: originalItem,
      labels,
      duration_ms: durationMs,
      status: 'success',
      level: 'info',
      message: `Item categorized successfully: ${itemId}`,
    };

    await this.logCategorizationEvent(event);
  }

  async logCategorizationError(
    eventId: string,
    itemId: string,
    tenantId: string,
    originalItem: any,
    error: Error,
    durationMs: number
  ): Promise<void> {
    const event: CategorizationEvent = {
      event_id: eventId,
      service: this.serviceName,
      event_type: 'categorization',
      timestamp: new Date(),
      item_id: itemId,
      tenant_id: tenantId,
      original_item: originalItem,
      labels: [],
      duration_ms: durationMs,
      status: 'error',
      error: error.message,
      level: 'error',
      message: `Failed to categorize item: ${itemId}`,
    };

    await this.logCategorizationEvent(event);
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
      this.logger.info('Elasticsearch logger closed');
    } catch (error) {
      this.logger.error('Error closing Elasticsearch logger', { error });
    }
  }
}
