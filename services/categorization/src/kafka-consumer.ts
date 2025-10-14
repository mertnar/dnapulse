import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import pino from 'pino';
import { Event } from './types';
import { RulesEngine } from './rules-engine';
import { 
  messageCounter, 
  processingDuration, 
  rulesEvaluated, 
  labelsGenerated 
} from './metrics';

export class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private rulesEngine: RulesEngine;
  private logger: pino.Logger;
  private inputTopic: string;
  private outputTopic: string;
  private isRunning = false;

  constructor(
    broker: string,
    inputTopic: string,
    outputTopic: string,
    rulesEngine: RulesEngine,
    logger: pino.Logger
  ) {
    this.kafka = new Kafka({
      clientId: 'categorization-service',
      brokers: [broker],
    });

    this.consumer = this.kafka.consumer({ 
      groupId: 'categorization-service-group' 
    });
    
    this.producer = this.kafka.producer();
    
    this.rulesEngine = rulesEngine;
    this.logger = logger;
    this.inputTopic = inputTopic;
    this.outputTopic = outputTopic;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    await this.consumer.connect();
    await this.producer.connect();
    
    await this.consumer.subscribe({ 
      topic: this.inputTopic,
      fromBeginning: false 
    });

    await this.consumer.run({
      eachMessage: this.handleMessage.bind(this),
    });

    this.isRunning = true;
    this.logger.info(`Kafka consumer started for topic: ${this.inputTopic}`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    await this.consumer.disconnect();
    await this.producer.disconnect();
    
    this.isRunning = false;
    this.logger.info('Kafka consumer stopped');
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const startTime = Date.now();
    
    try {
      const message = payload.message;
      if (!message.value) {
        this.logger.warn('Received message with no value');
        messageCounter.inc({ status: 'error' });
        return;
      }

      // Parse event
      const event: Event = JSON.parse(message.value.toString());
      
      // Apply categorization rules
      const labels = this.rulesEngine.evaluateEvent(event);
      
      // Update metrics
      this.rulesEngine.getRules().forEach(rule => {
        rulesEvaluated.inc({ 
          rule_id: rule.id, 
          result: 'evaluated' 
        });
      });
      
      labels.forEach(label => {
        labelsGenerated.inc({ label });
      });

      // Add labels to event attributes
      if (labels.length > 0) {
        event.attributes['labels'] = JSON.stringify(labels);
      }

      // Produce to output topic
      await this.producer.send({
        topic: this.outputTopic,
        messages: [{
          key: message.key,
          value: JSON.stringify(event),
          timestamp: message.timestamp || Date.now().toString(),
        }],
      });

      const duration = (Date.now() - startTime) / 1000;
      processingDuration.observe(duration);
      
      messageCounter.inc({ status: 'success' });
      
      this.logger.info({
        eventId: event.event_id,
        source: event.source,
        type: event.type,
        labels: labels.length,
        duration
      }, 'Event categorized successfully');

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      processingDuration.observe(duration);
      
      messageCounter.inc({ status: 'error' });
      
      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
        duration
      }, 'Failed to process message');
    }
  }
}
