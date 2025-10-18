import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoStore } from '../store';
import { ElasticsearchStore } from '../store';

export interface HealthRoutesOptions {
  mongoStore: MongoStore;
  elasticsearchStore?: ElasticsearchStore;
}

export async function healthRoutes(fastify: FastifyInstance, options: HealthRoutesOptions) {
  const { mongoStore, elasticsearchStore } = options;

  // Health check endpoint
  fastify.get('/health', async (_: FastifyRequest, reply: FastifyReply) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: 'unknown',
        elasticsearch: elasticsearchStore ? 'unknown' : 'disabled',
      },
    };

    try {
      // Check MongoDB connection
      await mongoStore.getLabelsCollection().findOne({});
      health.services.mongodb = 'healthy';
    } catch (error) {
      health.services.mongodb = 'unhealthy';
      health.status = 'unhealthy';
    }

    // Check Elasticsearch connection if enabled
    if (elasticsearchStore) {
      try {
        await elasticsearchStore['client'].ping();
        health.services.elasticsearch = 'healthy';
      } catch (error) {
        health.services.elasticsearch = 'unhealthy';
        health.status = 'unhealthy';
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    reply.code(statusCode).send(health);
  });

  // Readiness check endpoint
  fastify.get('/ready', async (_: FastifyRequest, reply: FastifyReply) => {
    const ready = {
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {
        mongodb: false,
        elasticsearch: elasticsearchStore ? false : true, // true if disabled
      },
    };

    try {
      // Check MongoDB readiness
      await mongoStore.getLabelsCollection().findOne({});
      ready.checks.mongodb = true;
    } catch (error) {
      ready.checks.mongodb = false;
      ready.ready = false;
    }

    // Check Elasticsearch readiness if enabled
    if (elasticsearchStore) {
      try {
        await elasticsearchStore['client'].ping();
        ready.checks.elasticsearch = true;
      } catch (error) {
        ready.checks.elasticsearch = false;
        ready.ready = false;
      }
    }

    const statusCode = ready.ready ? 200 : 503;
    reply.code(statusCode).send(ready);
  });
}
