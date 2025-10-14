import Fastify from 'fastify';
import cors from '@fastify/cors';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from './services/config.service';
import { MetricsService } from './services/metrics.service';
import { SchemaService } from './services/schema.service';
import { routes } from './routes';
import { config } from './config';

const fastify = Fastify({
  logger:
    config.nodeEnv === 'development'
      ? {
          level: config.logLevel,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          level: config.logLevel,
        },
});

// Register CORS
fastify.register(cors, {
  origin: true,
  credentials: true,
});

// Initialize services
let mongoClient: MongoClient;
let db: Db;
let configService: ConfigService;
let metricsService: MetricsService;
let schemaService: SchemaService;

// Startup function
async function start() {
  try {
    // Connect to MongoDB
    mongoClient = new MongoClient(config.mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db();

    fastify.log.info('Connected to MongoDB');

    // Initialize services
    metricsService = new MetricsService();
    schemaService = new SchemaService();
    configService = new ConfigService(db, schemaService, fastify.log);

    // Register metrics endpoint
    fastify.get('/metrics', async (_request, reply) => {
      reply.type('text/plain');
      return await metricsService.getMetrics();
    });

    // Register health endpoint
    fastify.get('/health', async (_request, reply) => {
      try {
        // Check MongoDB connection
        await db.admin().ping();

        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env['npm_package_version'] || '0.1.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          mongo: 'connected',
        };
      } catch (error) {
        reply.code(503);
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'MongoDB connection failed',
        };
      }
    });

    // Register routes
    await fastify.register(routes, {
      prefix: '/v1',
      configService,
      metricsService,
    });

    // Start server
    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    fastify.log.info(`Config service listening on ${config.host}:${config.port}`);

    // Initialize default configs
    await configService.initializeDefaultConfigs();
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received, shutting down gracefully');
  await fastify.close();
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  fastify.log.info('SIGINT received, shutting down gracefully');
  await fastify.close();
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

// Start the server
start();
