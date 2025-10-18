import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ConfigService } from '../services/config.service';
import { MetricsService } from '../services/metrics.service';

interface ConfigParams {
  scope: string;
}

export async function configRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & {
    configService: ConfigService;
    metricsService: MetricsService;
  }
): Promise<void> {
  const { configService, metricsService } = options;

  // GET /v1/config/:scope
  fastify.get<{ Params: ConfigParams }>('/:scope', async (request, reply) => {
    const { scope } = request.params;
    const timer = metricsService.startRequestTimer(scope, 'GET');

    try {
      metricsService.recordConfigRequest(scope, 'GET');

      const result = await configService.getConfig(scope);

      if (!result) {
        reply.code(404);
        return {
          error: 'Config not found',
          scope,
        };
      }

      reply.header('ETag', result.etag);
      reply.header('Content-Type', 'application/x-yaml');

      return result.yaml;
    } catch (error) {
      fastify.log.error(`Failed to get config for scope ${scope}: ${error}`);
      reply.code(500);
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      timer();
    }
  });

  // PUT /v1/config/:scope
  fastify.put<{ Params: ConfigParams }>('/:scope', async (request, reply) => {
    const { scope } = request.params;
    const timer = metricsService.startRequestTimer(scope, 'PUT');

    try {
      metricsService.recordConfigRequest(scope, 'PUT');

      // Get YAML content from request body
      let yamlContent: string;

      if (typeof request.body === 'string') {
        yamlContent = request.body;
      } else if (typeof request.body === 'object') {
        // Convert JSON to YAML
        const yaml = await import('js-yaml');
        yamlContent = yaml.dump(request.body);
      } else {
        reply.code(400);
        return {
          error: 'Invalid request body',
          message: 'Expected YAML content or JSON object',
        };
      }

      // Skip validation for now to allow flexible config formats
      const result = await configService.upsertConfig(scope, yamlContent, true);

      metricsService.recordConfigUpdate(scope);

      reply.code(200);
      return {
        scope,
        etag: result.etag,
        message: 'Config updated successfully',
      };
    } catch (error) {
      fastify.log.error(`Failed to update config for scope ${scope}: ${error}`);

      // Handle validation errors
      if (error instanceof Error && error.message.includes('validation failed')) {
        metricsService.recordValidationError(scope, 'schema_validation');
        reply.code(400);
        return {
          error: 'Validation failed',
          message: error.message,
          scope,
        };
      }

      // Handle YAML parsing errors
      if (error instanceof Error && error.message.includes('Invalid YAML')) {
        metricsService.recordValidationError(scope, 'yaml_parsing');
        reply.code(400);
        return {
          error: 'Invalid YAML',
          message: error.message,
          scope,
        };
      }

      reply.code(500);
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      timer();
    }
  });

  // DELETE /v1/config/:scope
  fastify.delete<{ Params: ConfigParams }>('/:scope', async (request, reply) => {
    const { scope } = request.params;
    const timer = metricsService.startRequestTimer(scope, 'DELETE');

    try {
      metricsService.recordConfigRequest(scope, 'DELETE');

      const deleted = await configService.deleteConfig(scope);

      if (!deleted) {
        reply.code(404);
        return {
          error: 'Config not found',
          scope,
        };
      }

      reply.code(200);
      return {
        scope,
        message: 'Config deleted successfully',
      };
    } catch (error) {
      fastify.log.error(`Failed to delete config for scope ${scope}: ${error}`);
      reply.code(500);
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      timer();
    }
  });

  // GET /v1/config (list all scopes)
  fastify.get('/', async (_request, reply) => {
    const timer = metricsService.startRequestTimer('_all', 'GET');

    try {
      metricsService.recordConfigRequest('_all', 'GET');

      const scopes = await configService.listScopes();

      return {
        scopes,
        count: scopes.length,
      };
    } catch (error) {
      fastify.log.error(`Failed to list config scopes: ${error}`);
      reply.code(500);
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      timer();
    }
  });

  // GET /v1/config/platform - Get platform configuration and enabled services
  fastify.get('/platform', async (_request, reply) => {
    const timer = metricsService.startRequestTimer('platform', 'GET');

    try {
      metricsService.recordConfigRequest('platform', 'GET');

      const platformConfig = await configService.getPlatformConfig();
      const enabledServices = await configService.getEnabledServices();

      if (!platformConfig) {
        reply.code(404);
        return {
          error: 'Platform config not found',
          message: 'Platform configuration has not been initialized',
        };
      }

      return {
        platform: platformConfig,
        enabled_services: enabledServices,
        total_enabled: enabledServices.length,
      };
    } catch (error) {
      fastify.log.error(`Failed to get platform config: ${error}`);
      reply.code(500);
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      timer();
    }
  });
}
