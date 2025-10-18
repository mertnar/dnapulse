import Fastify, { FastifyInstance } from 'fastify';
import pino from 'pino';
import { ConfigClient } from './config/client';
import { MongoStore } from './store';
import { ElasticsearchStore } from './store';
import { CategorizedItemsStore } from './store/categorized-items';
import { LabelerRegistry } from './labelers';
import { PipelineExecutor } from './pipeline';
import { MetricsCollector, initializeTracing } from './observability';
import { ElasticsearchLogger } from './observability/elasticsearch-logger';
import { KafkaEventPublisher } from './observability/kafka-publisher';
import { healthRoutes } from './routes/health';
import { labelsRoutes } from './routes/labels';
import { assignRoutes } from './routes/assign';
import { itemsRoutes } from './routes/items';
import { CategorizationConfig } from './model';

export interface AppOptions {
  port: number;
  host: string;
  configUrl: string;
  configScope: string;
  mongoUri: string;
  mongoDatabase: string;
  elasticsearchNode?: string;
  elasticsearchIndex?: string;
  kafkaBrokers?: string[];
  jaegerEndpoint?: string;
  jwtSecret?: string;
  bypassAuth?: boolean;
}

export class CategorizationApp {
  private fastify: FastifyInstance;
  private configClient: ConfigClient;
  private mongoStore: MongoStore;
  private elasticsearchStore?: ElasticsearchStore;
  private categorizedItemsStore?: CategorizedItemsStore;
  private elasticsearchLogger?: ElasticsearchLogger;
  private kafkaEventPublisher?: KafkaEventPublisher;
  private labelerRegistry: LabelerRegistry;
  private pipelineExecutor: PipelineExecutor;
  private metricsCollector: MetricsCollector;
  private logger: pino.Logger;

  constructor(private options: AppOptions) {
    // Initialize logger
    this.logger = pino({
      level: process.env['LOG_LEVEL'] || 'info',
      ...(process.env['NODE_ENV'] === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    });

    // Initialize Fastify
    this.fastify = Fastify({
      logger: true,
      trustProxy: true,
      bodyLimit: 10 * 1024 * 1024, // 10MB
    });

    // Initialize components
    this.configClient = new ConfigClient({
      baseUrl: options.configUrl,
      scope: options.configScope,
      logger: this.logger,
    });

    this.mongoStore = new MongoStore({
      uri: options.mongoUri,
      database: options.mongoDatabase,
      logger: this.logger,
    });

    // Initialize categorized items store
    this.categorizedItemsStore = new CategorizedItemsStore(
      this.mongoStore.getClient(),
      options.mongoDatabase,
      this.logger
    );

    if (options.elasticsearchNode && options.elasticsearchIndex) {
      this.elasticsearchStore = new ElasticsearchStore({
        node: options.elasticsearchNode,
        index: options.elasticsearchIndex,
        logger: this.logger,
      });

      // Initialize Elasticsearch logger for categorization events
      this.elasticsearchLogger = new ElasticsearchLogger(
        options.elasticsearchNode,
        options.elasticsearchIndex,
        'categorization',
        this.logger
      );
    }

    this.labelerRegistry = new LabelerRegistry();
    this.pipelineExecutor = new PipelineExecutor({
      registry: this.labelerRegistry,
      logger: this.logger,
      ...(this.categorizedItemsStore && { categorizedItemsStore: this.categorizedItemsStore }),
      ...(this.elasticsearchLogger && { elasticsearchLogger: this.elasticsearchLogger }),
      ...(this.kafkaEventPublisher && { kafkaEventPublisher: this.kafkaEventPublisher }),
    });

    this.metricsCollector = new MetricsCollector({
      serviceName: 'categorization',
      logger: this.logger,
    });

    // Initialize Kafka event publisher if brokers are provided
    this.logger.info('Kafka brokers check', { kafkaBrokers: options.kafkaBrokers });
    if (options.kafkaBrokers && options.kafkaBrokers.length > 0) {
      this.logger.info('Initializing Kafka event publisher', { brokers: options.kafkaBrokers });
      this.kafkaEventPublisher = new KafkaEventPublisher(
        options.kafkaBrokers,
        'categorization-events',
        this.logger
      );
    } else {
      this.logger.info('Kafka brokers not provided, skipping Kafka publisher initialization');
    }
  }

  async start(): Promise<void> {
    try {
      // Initialize tracing
      initializeTracing({
        serviceName: 'categorization',
        serviceVersion: process.env['npm_package_version'] || '1.0.0',
        ...(this.options.jaegerEndpoint && { jaegerEndpoint: this.options.jaegerEndpoint }),
        logger: this.logger,
      });

      // Connect to stores
      await this.mongoStore.connect();
      if (this.elasticsearchStore) {
        await this.elasticsearchStore.connect();
      }

      // Initialize categorized items store
      if (this.categorizedItemsStore) {
        await this.categorizedItemsStore.initialize();
      }

      // Connect Kafka event publisher
      if (this.kafkaEventPublisher) {
        await this.kafkaEventPublisher.connect();
      }

      // Load initial configuration
      const config = await this.configClient.loadConfig();
      this.pipelineExecutor.setConfig(config);
      this.metricsCollector.updateConfigVersion(config.version);
      this.metricsCollector.updatePipelineCount(config.pipelines.length);

      // Setup hot-reload
      this.configClient.watchConfig((newConfig: CategorizationConfig) => {
        this.logger.info('Configuration hot-reloaded', {
          version: newConfig.version,
          cardinality: newConfig.cardinality,
        });
        this.pipelineExecutor.setConfig(newConfig);
        this.metricsCollector.updateConfigVersion(newConfig.version);
        this.metricsCollector.updatePipelineCount(newConfig.pipelines.length);
      });

      // Setup middleware
      await this.setupMiddleware();

      // Setup routes
      await this.setupRoutes();

      // Start server
      await this.fastify.listen({
        port: this.options.port,
        host: this.options.host,
      });

      this.logger.info('Categorization service started', {
        port: this.options.port,
        host: this.options.host,
        configUrl: this.options.configUrl,
        configScope: this.options.configScope,
        elasticsearchEnabled: !!this.elasticsearchStore,
      });
    } catch (error) {
      this.logger.error('Failed to start categorization service', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop config client
      this.configClient.close();

      // Disconnect from stores
      await this.mongoStore.disconnect();
      if (this.elasticsearchStore) {
        await this.elasticsearchStore.disconnect();
      }

      // Stop Fastify
      await this.fastify.close();

      this.logger.info('Categorization service stopped');
    } catch (error) {
      this.logger.error('Error stopping categorization service', error);
      throw error;
    }
  }

  private async setupMiddleware(): Promise<void> {
    // CORS
    await this.fastify.register(require('@fastify/cors'), {
      origin: true,
      credentials: true,
    });

    // Request logging
    this.fastify.addHook('onRequest', async (request) => {
      const startTime = Date.now();
      (request as any).startTime = startTime;
    });

    this.fastify.addHook('onResponse', async (request, reply) => {
      const duration = (Date.now() - ((request as any).startTime || Date.now())) / 1000;
      this.metricsCollector.recordApiTime(
        request.method,
        request.routerPath,
        reply.statusCode,
        duration
      );
    });

    // JWT authentication (placeholder)
    if (!this.options.bypassAuth && this.options.jwtSecret) {
      await this.fastify.register(require('@fastify/jwt'), {
        secret: this.options.jwtSecret,
      });

      this.fastify.addHook('onRequest', async (request, reply) => {
        // Skip auth for health endpoints
        if (request.url.startsWith('/health') || request.url.startsWith('/ready')) {
          return;
        }

        try {
          await (request as any).jwtVerify();
        } catch (err) {
          reply.code(401).send({ error: 'Unauthorized' });
        }
      });
    }

    // Metrics endpoint
    this.fastify.get('/metrics', async (_, reply) => {
      const metrics = await this.metricsCollector.getMetrics();
      reply.type('text/plain').send(metrics);
    });
  }

  private async setupRoutes(): Promise<void> {
    // Health routes
    await this.fastify.register(healthRoutes, {
      mongoStore: this.mongoStore,
      ...(this.elasticsearchStore && { elasticsearchStore: this.elasticsearchStore }),
    });

    // API routes
    await this.fastify.register(labelsRoutes, {
      mongoStore: this.mongoStore,
    });

    await this.fastify.register(assignRoutes, {
      mongoStore: this.mongoStore,
      ...(this.elasticsearchStore && { elasticsearchStore: this.elasticsearchStore }),
      pipelineExecutor: this.pipelineExecutor,
    });

    await this.fastify.register(itemsRoutes, {
      mongoStore: this.mongoStore,
      ...(this.elasticsearchStore && { elasticsearchStore: this.elasticsearchStore }),
    });

    // Root endpoint
    this.fastify.get('/', async (_, reply) => {
      reply.send({
        service: 'categorization',
        version: process.env['npm_package_version'] || '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          ready: '/ready',
          metrics: '/metrics',
          labels: '/v1/labels',
          assign: '/v1/assign',
          items: '/v1/items',
        },
      });
    });
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
