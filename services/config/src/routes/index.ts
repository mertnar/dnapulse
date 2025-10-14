import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ConfigService } from '../services/config.service';
import { MetricsService } from '../services/metrics.service';
import { configRoutes } from './config.routes';
import { streamRoutes } from './stream.routes';

export async function routes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & {
    configService: ConfigService;
    metricsService: MetricsService;
  }
): Promise<void> {
  const { configService, metricsService } = options;

  // Register config routes
  await fastify.register(configRoutes, {
    prefix: '/config',
    configService,
    metricsService,
  });

  // Register stream routes
  await fastify.register(streamRoutes, {
    prefix: '/',
    configService,
    metricsService,
  });

  // Health check for config service
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'healthy',
      service: 'config',
      timestamp: new Date().toISOString(),
      subscribers: configService.getSubscriberCount(),
    };
  });
}
