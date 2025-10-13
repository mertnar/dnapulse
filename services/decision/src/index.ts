import { Kafka, EachMessagePayload } from 'kafkajs';
import axios from 'axios';
import * as protobuf from 'protobufjs';
import * as path from 'path';

interface Event {
  eventId: string;
  source: string;
  type: number;
  ts?: { seconds: number; nanos: number };
  attributes: Record<string, string>;
  body?: {
    metric?: {
      name: string;
      value: number;
      unit: string;
    };
  };
}

interface Alert {
  '@timestamp': string;
  event_id: string;
  event_type: string;
  source: string;
  severity: string;
  metric_name: string;
  metric_value: number;
  threshold?: number;
  message: string;
  raw_data: any;
}

class DecisionService {
  private kafka: Kafka;
  private elasticsearchUrl: string;
  private indexName: string;
  private eventProto: protobuf.Type | null = null;

  constructor() {
    const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    const inputTopic = process.env.KAFKA_INPUT_TOPIC || 'processing.cleaned.v1';
    const groupId = process.env.KAFKA_GROUP_ID || 'decision-service';
    this.elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    this.indexName = process.env.ELASTICSEARCH_INDEX || 'alerts';

    console.log('Decision service configuration:');
    console.log(`  Kafka brokers: ${kafkaBrokers.join(', ')}`);
    console.log(`  Input topic: ${inputTopic}`);
    console.log(`  Consumer group: ${groupId}`);
    console.log(`  Elasticsearch: ${this.elasticsearchUrl}`);
    console.log(`  Index: ${this.indexName}`);
    console.log(`  Format: protobuf`);

    this.kafka = new Kafka({
      clientId: 'decision-service',
      brokers: kafkaBrokers,
      retry: {
        retries: 5,
        initialRetryTime: 300,
      },
    });
  }

  async loadProto() {
    try {
      // Load protobuf schema
      const protoPath = path.join(__dirname, '../../../contracts/proto/event/v1/event.proto');
      const root = await protobuf.load(protoPath);
      this.eventProto = root.lookupType('dna.event.v1.Event');
      console.log('Protobuf schema loaded successfully');
    } catch (error) {
      console.warn('Could not load protobuf schema, using fallback decoder:', error);
      // In production, you'd use the generated types from sdks/ts-sdk
    }
  }

  async start() {
    await this.loadProto();

    const consumer = this.kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || 'decision-service',
    });

    await consumer.connect();
    console.log('Connected to Kafka');

    await consumer.subscribe({
      topic: process.env.KAFKA_INPUT_TOPIC || 'processing.cleaned.v1',
      fromBeginning: false,
    });

    console.log('Subscribed to topic, waiting for messages...');

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.processMessage(payload);
      },
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down...');
      await consumer.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  private async processMessage(payload: EachMessagePayload) {
    const { message } = payload;

    try {
      const value = message.value;
      if (!value) {
        console.warn('Received empty message');
        return;
      }

      // Decode protobuf message
      let event: Event;

      if (this.eventProto) {
        const decoded = this.eventProto.decode(value);
        event = this.eventProto.toObject(decoded, { longs: Number }) as Event;
      } else {
        // Fallback: simple binary decode (not recommended for production)
        event = this.decodeEventFallback(value);
      }

      console.log(`Processing event (protobuf): ${event.eventId}`);

      // Decision logic: Check if event requires an alert
      if (this.shouldCreateAlert(event)) {
        const alert = this.createAlert(event);
        await this.indexAlert(alert);
        console.log(`Alert created: ${alert.event_id} - ${alert.message} [${alert.severity}]`);
      } else {
        console.log(`Event ${event.eventId} does not require an alert`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  private decodeEventFallback(buffer: Buffer): Event {
    // This is a simplified fallback - in production use proper protobuf generated code
    // For now, we'll try to extract basic info
    const str = buffer.toString('utf8');
    return {
      eventId: `decoded-${Date.now()}`,
      source: 'unknown',
      type: 1,
      attributes: {},
    };
  }

  private shouldCreateAlert(event: Event): boolean {
    // Decision rules: Create alert for warning or critical severity
    const severity = event.attributes?.severity || 'info';
    const isValid = event.attributes?.is_valid === 'true';

    if (!isValid) {
      return false;
    }

    return severity === 'warning' || severity === 'critical';
  }

  private createAlert(event: Event): Alert {
    const metric = event.body?.metric;
    const metricName = metric?.name || 'unknown';
    const metricValue = metric?.value || 0;
    const severity = event.attributes?.severity || 'info';

    // Determine threshold based on metric
    let threshold: number | undefined;
    const nameLower = metricName.toLowerCase();
    if (nameLower.includes('cpu')) {
      threshold = severity === 'critical' ? 90 : 75;
    } else if (nameLower.includes('memory')) {
      threshold = severity === 'critical' ? 90 : 80;
    } else if (nameLower.includes('disk')) {
      threshold = severity === 'critical' ? 85 : 70;
    }

    // Create alert message
    const message = `${severity.toUpperCase()}: ${metricName} on ${event.source} is ${metricValue}${
      threshold ? ` (threshold: ${threshold})` : ''
    }`;

    // Convert timestamp
    let timestamp = new Date().toISOString();
    if (event.ts) {
      timestamp = new Date(event.ts.seconds * 1000).toISOString();
    }

    return {
      '@timestamp': timestamp,
      event_id: event.eventId,
      event_type: 'metric',
      source: event.source,
      severity,
      metric_name: metricName,
      metric_value: metricValue,
      threshold,
      message,
      raw_data: event,
    };
  }

  private async indexAlert(alert: Alert): Promise<void> {
    try {
      const response = await axios.post(`${this.elasticsearchUrl}/${this.indexName}/_doc`, alert, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      if (response.status >= 200 && response.status < 300) {
        console.log(`Alert indexed successfully: ${response.data._id}`);
      } else {
        console.error(`Failed to index alert: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Elasticsearch error: ${error.message}`);
        if (error.response) {
          console.error(`Response: ${JSON.stringify(error.response.data)}`);
        }
      } else {
        console.error('Error indexing alert:', error);
      }
      throw error;
    }
  }
}

// Start the service
const service = new DecisionService();
service.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
