import { Kafka, Producer } from 'kafkajs';
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
}

export class KafkaEventPublisher {
  private producer: Producer;
  private topic: string;
  private logger: pino.Logger;

  constructor(kafkaBrokers: string[], topic: string, logger?: pino.Logger) {
    this.logger = logger || pino({ level: 'info' });
    this.topic = topic;

    const kafka = new Kafka({
      clientId: 'categorization-service',
      brokers: kafkaBrokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = kafka.producer();
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.info('Kafka event publisher connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka event publisher', { error });
      throw error;
    }
  }

  async publishCategorizationEvent(event: CategorizationEvent): Promise<void> {
    try {
      const message = {
        key: event.item_id,
        value: JSON.stringify(event),
        timestamp: event.timestamp.getTime().toString(),
      };

      await this.producer.send({
        topic: this.topic,
        messages: [message],
      });

      this.logger.debug('Categorization event published to Kafka', {
        event_id: event.event_id,
        item_id: event.item_id,
        topic: this.topic,
      });
    } catch (error) {
      this.logger.error('Failed to publish categorization event to Kafka', {
        event_id: event.event_id,
        item_id: event.item_id,
        error,
      });
      // Don't throw - publishing failures shouldn't break the main flow
    }
  }

  async publishCategorizationSuccess(
    eventId: string,
    itemId: string,
    tenantId: string,
    originalItem: any,
    labels: any[],
    durationMs: number
  ): Promise<void> {
    const event: CategorizationEvent = {
      event_id: eventId,
      service: 'categorization',
      event_type: 'categorization',
      timestamp: new Date(),
      item_id: itemId,
      tenant_id: tenantId,
      original_item: originalItem,
      labels,
      duration_ms: durationMs,
      status: 'success',
    };

    await this.publishCategorizationEvent(event);
  }

  async publishCategorizationError(
    eventId: string,
    itemId: string,
    tenantId: string,
    originalItem: any,
    error: Error,
    durationMs: number
  ): Promise<void> {
    const event: CategorizationEvent = {
      event_id: eventId,
      service: 'categorization',
      event_type: 'categorization',
      timestamp: new Date(),
      item_id: itemId,
      tenant_id: tenantId,
      original_item: originalItem,
      labels: [],
      duration_ms: durationMs,
      status: 'error',
      error: error.message,
    };

    await this.publishCategorizationEvent(event);
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.logger.info('Kafka event publisher disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka event publisher', { error });
    }
  }
}
