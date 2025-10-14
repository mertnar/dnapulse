import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ConfigService, ConfigUpdateEvent } from '../services/config.service';
import { MetricsService } from '../services/metrics.service';
import { config } from '../config';

export async function streamRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & {
    configService: ConfigService;
    metricsService: MetricsService;
  }
): Promise<void> {
  const { configService, metricsService } = options;

  // GET /v1/stream - Server-Sent Events for config changes
  fastify.get('/stream', async (request, reply) => {
    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection event
    reply.raw.write('event: connected\n');
    reply.raw.write(
      `data: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        message: 'Connected to config stream',
      })}\n\n`
    );

    // Subscribe to config updates
    const unsubscribe = configService.subscribeToUpdates((event: ConfigUpdateEvent) => {
      try {
        const data = {
          scope: event.scope,
          etag: event.etag,
          timestamp: event.timestamp.toISOString(),
        };

        reply.raw.write('event: config:update\n');
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

        fastify.log.debug(`Sent config update event for scope: ${event.scope}`);
      } catch (error) {
        fastify.log.error(`Error sending SSE event: ${error}`);
      }
    });

    // Update metrics
    const currentSubscribers = configService.getSubscriberCount();
    metricsService.setActiveSubscribers(currentSubscribers);

    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        reply.raw.write('event: heartbeat\n');
        reply.raw.write(
          `data: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            subscribers: configService.getSubscriberCount(),
          })}\n\n`
        );
      } catch (error) {
        fastify.log.error(`Error sending heartbeat: ${error}`);
        clearInterval(heartbeatInterval);
      }
    }, config.sseHeartbeatInterval);

    // Handle client disconnect
    request.raw.on('close', () => {
      fastify.log.info('SSE client disconnected');
      unsubscribe();
      clearInterval(heartbeatInterval);

      // Update metrics
      const newSubscribers = configService.getSubscriberCount();
      metricsService.setActiveSubscribers(newSubscribers);
    });

    // Handle errors
    request.raw.on('error', (error) => {
      fastify.log.error(`SSE connection error: ${error}`);
      unsubscribe();
      clearInterval(heartbeatInterval);
    });

    // Send initial heartbeat
    setTimeout(() => {
      try {
        reply.raw.write('event: heartbeat\n');
        reply.raw.write(
          `data: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            subscribers: configService.getSubscriberCount(),
          })}\n\n`
        );
      } catch (error) {
        fastify.log.error(`Error sending initial heartbeat: ${error}`);
      }
    }, 1000);

    fastify.log.info('SSE client connected');
  });

  // GET /v1/stream/status - Get stream status
  fastify.get('/stream/status', async (_request, _reply) => {
    return {
      active_subscribers: configService.getSubscriberCount(),
      heartbeat_interval: config.sseHeartbeatInterval,
      max_clients: config.sseMaxClients,
      uptime: process.uptime(),
    };
  });
}
