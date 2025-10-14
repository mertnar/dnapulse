import { Kafka, EachMessagePayload } from 'kafkajs';
import Fastify from 'fastify';
import pino from 'pino';
// Note: Protobuf imports will be fixed after buf generate
// import { Event as ProtoEvent } from '../../../sdks/ts-sdk/gen/event/v1/event_pb';
import { PolicyEngine } from './engine/policy-engine';
import { PluginRegistry } from './plugins/plugin-registry';
import { ConfigClient } from './utils/config-client';
import { EvaluationContext } from './types/policy';

const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: process.env['NODE_ENV'] === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  } : undefined
});

// Environment configuration
const KAFKA_BROKERS = (process.env['KAFKA_BROKERS'] || 'localhost:9092').split(',');
const KAFKA_CLIENT_ID = process.env['KAFKA_CLIENT_ID'] || 'decision-service';
const KAFKA_GROUP_ID = process.env['KAFKA_GROUP_ID'] || 'decision-group';
const INPUT_TOPIC = process.env['INPUT_TOPIC'] || 'processing.cleaned.v1';
const ELASTICSEARCH_URL = process.env['ELASTICSEARCH_URL'] || 'http://localhost:9200';
const CONFIG_SERVICE_URL = process.env['CONFIG_SERVICE_URL'] || 'http://localhost:8083';
const CONFIG_SCOPE = process.env['CONFIG_SCOPE'] || 'decision';
const CONFIG_SSE_URL = process.env['CONFIG_SSE_URL'] || 'http://localhost:8083';
const HTTP_PORT = parseInt(process.env['PORT'] || process.env['HTTP_PORT'] || '8080', 10);

// Initialize components
const pluginRegistry = new PluginRegistry(ELASTICSEARCH_URL);
const policyEngine = new PolicyEngine(pluginRegistry);
const configClient = new ConfigClient(CONFIG_SERVICE_URL, CONFIG_SCOPE);

// Initialize Fastify for HTTP endpoints
const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] || 'info'
  }
});

// Policy debug endpoint (guarded by DEBUG=1)
fastify.get('/policy/debug', async (_request, _reply) => {
  if (process.env['DEBUG'] !== '1') {
    return _reply.status(403).send({ error: 'Debug mode not enabled' });
  }
  
  return {
    policies: policyEngine.getPolicies(),
    stats: policyEngine.getStats(),
    config_scope: CONFIG_SCOPE,
    config_url: CONFIG_SERVICE_URL,
    timestamp: new Date().toISOString()
  };
});

// Health endpoint
fastify.get('/health', async (_request, _reply) => {
  return {
    status: 'healthy',
    service: 'decision',
    policies: policyEngine.getPolicies().length,
    plugins: pluginRegistry.list(),
    timestamp: new Date().toISOString()
  };
});

// Metrics endpoint (placeholder)
fastify.get('/metrics', async (_request, _reply) => {
  return {
    policies_loaded: policyEngine.getPolicies().length,
    plugins_registered: pluginRegistry.list().length
  };
});

// Load initial policies
async function loadPolicies() {
  try {
    logger.info(`Loading policies from Config Service for scope: ${CONFIG_SCOPE}...`);
    const config = await configClient.fetchConfig();
    policyEngine.loadPolicies(config);
    logger.info(`Loaded ${policyEngine.getPolicies().length} policies`);
  } catch (error) {
    logger.error(`Failed to load policies: ${error}`);
    // Use default empty config
    policyEngine.loadPolicies({ alerts: [] });
  }
}

// Subscribe to policy updates
function subscribeToPolicyUpdates() {
  const unsubscribe = configClient.subscribeToUpdates(
    (config) => {
      logger.info('Reloading policies due to config update');
      policyEngine.loadPolicies(config);
      logger.info(`Reloaded ${policyEngine.getPolicies().length} policies`);
    },
    (error) => {
      logger.error(`Config update error: ${error.message}`);
    }
  );

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, unsubscribing from config updates');
    unsubscribe();
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, unsubscribing from config updates');
    unsubscribe();
  });
}

// Process Kafka message
async function processMessage(payload: EachMessagePayload) {
  try {
    // For now, parse JSON until protobuf is properly set up
    const messageValue = payload.message.value;
    if (!messageValue) {
      logger.warn('Received empty message');
      return;
    }

    const event = JSON.parse(messageValue.toString());

    // Create evaluation context
    const context: EvaluationContext = {
      type: event.type || 'unknown',
      payload: event.metric || event.log || event.text || event.imageRef || event.payload || {},
      attributes: event.attributes || {},
      ts: event.ts || new Date().toISOString()
    };

    // Evaluate policies
    const results = await policyEngine.evaluate(context);
    
    // Log evaluation results
    const matchedPolicies = results.filter(r => r.matched);
    if (matchedPolicies.length > 0) {
      logger.info({
        event_id: event.eventId || event.event_id,
        matched_policies: matchedPolicies.map(r => r.policyId),
        actions_count: matchedPolicies.reduce((sum, r) => sum + (r.actions?.length || 0), 0)
      }, 'Policies matched');
    }
  } catch (error) {
    logger.error(`Error processing message: ${error}`);
  }
}

// Main function
async function main() {
  try {
    // Start HTTP server
    await fastify.listen({ port: HTTP_PORT, host: '0.0.0.0' });
    logger.info(`HTTP server listening on port ${HTTP_PORT}`);

    // Load initial policies
    await loadPolicies();

    // Subscribe to policy updates
    subscribeToPolicyUpdates();

    // Initialize Kafka (optional for testing)
    if (KAFKA_BROKERS[0] !== 'localhost:9092') {
      const kafka = new Kafka({
        clientId: KAFKA_CLIENT_ID,
        brokers: KAFKA_BROKERS
      });

      const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

      await consumer.connect();
      logger.info('Connected to Kafka');

      await consumer.subscribe({ topic: INPUT_TOPIC, fromBeginning: false });
      logger.info(`Subscribed to topic: ${INPUT_TOPIC}`);

      await consumer.run({
        eachMessage: processMessage
      });

      logger.info('Decision service started successfully with Kafka');
    } else {
      logger.info('Decision service started successfully (Kafka disabled for testing)');
    }
  } catch (error) {
    logger.error(`Failed to start decision service: ${error}`);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await fastify.close();
  configClient.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await fastify.close();
  configClient.close();
  process.exit(0);
});

// Start the service
main();
