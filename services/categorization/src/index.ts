import Fastify from 'fastify';
import pino from 'pino';
import { config } from './config';
import { RulesEngine } from './rules-engine';
import { KafkaConsumer } from './kafka-consumer';
import { ConfigManager } from './config-manager';
import { routes } from './routes';

// Create logger
const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  ...(config.nodeEnv === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Create services
const rulesEngine = new RulesEngine();
const configManager = new ConfigManager(
  config.configUrl,
  config.configScope,
  config.configSseUrl,
  rulesEngine,
  logger
);
const kafkaConsumer = new KafkaConsumer(
  config.busBroker,
  config.inputTopic,
  config.outputTopic,
  rulesEngine,
  logger
);

// Create Fastify instance
const fastify = Fastify({
  disableRequestLogging: true,
});

// Register routes
fastify.register(routes);

// Add services to Fastify instance for route access
fastify.decorate('configManager', configManager);
fastify.decorate('rulesEngine', rulesEngine);

async function start() {
  try {
    // Load initial configuration
    await configManager.loadInitialConfig();

    // Start config hot reload
    configManager.startHotReload();

    // Start Kafka consumer
    await kafkaConsumer.start();

    // Start HTTP server
    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    logger.info(
      {
        port: config.port,
        host: config.host,
        inputTopic: config.inputTopic,
        outputTopic: config.outputTopic,
        configScope: config.configScope,
        rulesLoaded: configManager.getRuleCount(),
      },
      'Categorization service started successfully'
    );

    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await shutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await shutdown();
    });
  } catch (error) {
    logger.error(error, 'Failed to start categorization service');
    process.exit(1);
  }
}

async function shutdown() {
  try {
    // Stop Kafka consumer
    await kafkaConsumer.stop();

    // Stop config hot reload
    configManager.stopHotReload();

    // Close HTTP server
    await fastify.close();

    logger.info('Categorization service stopped successfully');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
}

// Start the service
start();
