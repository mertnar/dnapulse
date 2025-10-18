import { Kafka, Producer } from 'kafkajs';
import pino from 'pino';

export interface ServiceEvent {
  event_id: string;
  service: string;
  event_type: string;
  timestamp: string;
  source?: any;
  payload?: any;
  attributes?: any;
  status: string;
  duration_ms?: number;
  error?: string;
}

export class EventPublisher {
  private producer: Producer;
  private logger: pino.Logger;

  constructor(
    private brokers: string[],
    private topic: string = 'service-events',
    logger?: pino.Logger
  ) {
    this.logger = logger || pino({ level: 'info' });

    const kafka = new Kafka({
      clientId: 'categorization-service',
      brokers: this.brokers,
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

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.logger.info('Kafka event publisher disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect Kafka event publisher', { error });
    }
  }

  async publishEvent(event: ServiceEvent): Promise<void> {
    try {
      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: event.event_id,
            value: JSON.stringify(event),
            timestamp: Date.now().toString(),
          },
        ],
      });

      this.logger.debug('Service event published', {
        event_id: event.event_id,
        event_type: event.event_type,
      });
    } catch (error) {
      this.logger.error('Failed to publish service event', {
        event_id: event.event_id,
        error,
      });
      throw error;
    }
  }

  async publishCategorizationEvent(
    eventId: string,
    item: any,
    labels: any[],
    status: string,
    duration: number,
    error?: Error
  ): Promise<void> {
    const event: ServiceEvent = {
      event_id: eventId,
      service: 'categorization',
      event_type: 'categorization',
      timestamp: new Date().toISOString(),
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
      event.status = 'error';
      event.error = error.message;
    }

    await this.publishEvent(event);
  }

  async publishConfigUpdateEvent(scope: string, etag: string): Promise<void> {
    const event: ServiceEvent = {
      event_id: `config_${scope}_${etag}`,
      service: 'categorization',
      event_type: 'config_update',
      timestamp: new Date().toISOString(),
      attributes: {
        scope: scope,
        etag: etag,
      },
      status: 'success',
    };

    await this.publishEvent(event);
  }

  async publishHealthCheckEvent(status: string, duration: number): Promise<void> {
    const event: ServiceEvent = {
      event_id: `health_${Date.now()}`,
      service: 'categorization',
      event_type: 'health_check',
      timestamp: new Date().toISOString(),
      status: status,
      duration_ms: duration,
    };

    await this.publishEvent(event);
  }
}
