import { FastifyInstance } from 'fastify';
import { getMetrics } from './metrics';
import { ConfigManager } from './config-manager';

export async function routes(fastify: FastifyInstance) {
  const configManager = (fastify as any).configManager as ConfigManager;

  // Health check endpoint
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'healthy',
      service: 'categorization',
      timestamp: new Date().toISOString(),
      rules: configManager.getRuleCount()
    });
  });

  // Metrics endpoint
  fastify.get('/metrics', async (_request, reply) => {
    const metrics = await getMetrics();
    return reply
      .type('text/plain')
      .send(metrics);
  });

  // Debug endpoint for rules (only in development)
  fastify.get('/debug/rules', async (_request, reply) => {
    if (process.env['NODE_ENV'] === 'production') {
      return reply.status(404).send({ error: 'Not found' });
    }

    const rules = ((fastify as any).rulesEngine as any).getRules();
    return reply.send({
      rules,
      count: rules.length,
      etag: configManager.getCurrentEtag()
    });
  });

  // Config reload endpoint (for manual reloads)
  fastify.post('/admin/reload-config', async (_request, reply) => {
    try {
      await configManager.loadConfig();
      return reply.send({
        status: 'success',
        message: 'Config reloaded successfully',
        rules: configManager.getRuleCount(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to reload config',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
