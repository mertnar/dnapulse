#!/usr/bin/env ts-node

import { Kafka } from 'kafkajs';
import * as fs from 'fs';
import * as path from 'path';

interface DLQMessage {
  original_topic: string;
  original_partition: number;
  original_offset: number;
  original_message: any;
  error: string;
  service: string;
  timestamp: string;
  trace_id?: string;
  span_id?: string;
}

interface InspectOptions {
  brokers: string[];
  topics: string[];
  limit: number;
  output?: string;
  json: boolean;
}

class DLQInspector {
  private kafka: Kafka;
  private options: InspectOptions;

  constructor(options: InspectOptions) {
    this.kafka = new Kafka({
      clientId: 'dlq-inspector',
      brokers: options.brokers
    });
    this.options = options;
  }

  async inspect(): Promise<void> {
    console.log('🔍 DLQ Inspector Starting...\n');

    for (const topic of this.options.topics) {
      console.log(`📋 Inspecting topic: ${topic}`);
      
      try {
        const messages = await this.getDLQMessages(topic);
        
        if (messages.length === 0) {
          console.log(`  ✅ No messages found in ${topic}\n`);
          continue;
        }

        console.log(`  📊 Found ${messages.length} messages\n`);

        if (this.options.json) {
          this.outputJSON(topic, messages);
        } else {
          this.outputHumanReadable(topic, messages);
        }

      } catch (error) {
        console.error(`  ❌ Error inspecting ${topic}:`, error);
      }

      console.log('');
    }
  }

  private async getDLQMessages(topic: string): Promise<DLQMessage[]> {
    const consumer = this.kafka.consumer({ groupId: 'dlq-inspector' });
    
    try {
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      const messages: DLQMessage[] = [];
      let messageCount = 0;

      await consumer.run({
        eachMessage: async ({ message }) => {
          if (messageCount >= this.options.limit) {
            return;
          }

          try {
            const dlqMsg: DLQMessage = JSON.parse(message.value?.toString() || '{}');
            messages.push(dlqMsg);
            messageCount++;
          } catch (error) {
            console.error('Failed to parse DLQ message:', error);
          }
        },
      });

      // Wait for messages or timeout
      await new Promise(resolve => setTimeout(resolve, 5000));

      return messages;
    } finally {
      await consumer.disconnect();
    }
  }

  private outputHumanReadable(topic: string, messages: DLQMessage[]): void {
    console.log(`📋 DLQ Messages for ${topic}:`);
    console.log('=' .repeat(60));

    messages.forEach((msg, index) => {
      console.log(`\n🔸 Message ${index + 1}:`);
      console.log(`   Service: ${msg.service}`);
      console.log(`   Original Topic: ${msg.original_topic}`);
      console.log(`   Original Partition: ${msg.original_partition}`);
      console.log(`   Original Offset: ${msg.original_offset}`);
      console.log(`   Timestamp: ${msg.timestamp}`);
      console.log(`   Error: ${msg.error}`);
      
      if (msg.trace_id) {
        console.log(`   Trace ID: ${msg.trace_id}`);
      }
      if (msg.span_id) {
        console.log(`   Span ID: ${msg.span_id}`);
      }

      console.log(`   Original Message Preview:`);
      try {
        const originalMsg = typeof msg.original_message === 'string' 
          ? JSON.parse(msg.original_message) 
          : msg.original_message;
        console.log(`     ${JSON.stringify(originalMsg, null, 2).substring(0, 200)}...`);
      } catch (error) {
        console.log(`     ${msg.original_message.toString().substring(0, 200)}...`);
      }
    });

    console.log('\n' + '='.repeat(60));
  }

  private outputJSON(topic: string, messages: DLQMessage[]): void {
    const output = {
      topic,
      timestamp: new Date().toISOString(),
      message_count: messages.length,
      messages
    };

    if (this.options.output) {
      const outputPath = path.resolve(this.options.output);
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`  💾 Output saved to: ${outputPath}`);
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 DLQ Inspector

Usage: ts-node scripts/dlq_inspect.ts [options]

Options:
  --brokers <brokers>     Kafka brokers (comma-separated) [default: localhost:9092]
  --topics <topics>       DLQ topics to inspect (comma-separated) [default: *.deadletter.v1]
  --limit <number>        Maximum messages to retrieve per topic [default: 10]
  --output <file>         Output file for JSON format
  --json                  Output in JSON format
  --help, -h              Show this help message

Examples:
  # Inspect all DLQ topics
  ts-node scripts/dlq_inspect.ts

  # Inspect specific topics with JSON output
  ts-node scripts/dlq_inspect.ts --topics processing.deadletter.v1,decision.deadletter.v1 --json --output dlq-report.json

  # Inspect with custom brokers and limit
  ts-node scripts/dlq_inspect.ts --brokers kafka1:9092,kafka2:9092 --limit 50
`);
    process.exit(0);
  }

  const brokers = args.includes('--brokers') 
    ? args[args.indexOf('--brokers') + 1].split(',')
    : ['localhost:9092'];

  const topicsArg = args.includes('--topics')
    ? args[args.indexOf('--topics') + 1].split(',')
    : ['processing.deadletter.v1', 'decision.deadletter.v1'];

  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1], 10)
    : 10;

  const output = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : undefined;

  const json = args.includes('--json');

  const options: InspectOptions = {
    brokers,
    topics: topicsArg,
    limit,
    output,
    json
  };

  const inspector = new DLQInspector(options);
  await inspector.inspect();
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the inspector
main().catch(console.error);