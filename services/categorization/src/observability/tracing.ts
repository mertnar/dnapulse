import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Logger } from 'pino';

export interface TracingOptions {
  serviceName: string;
  serviceVersion: string;
  jaegerEndpoint?: string;
  logger: Logger;
}

export function initializeTracing(options: TracingOptions): NodeSDK {
  const { serviceName, serviceVersion, jaegerEndpoint, logger } = options;

  // Create Jaeger exporter
  const jaegerExporter = new JaegerExporter({
    endpoint: jaegerEndpoint || 'http://localhost:14268/api/traces',
  });

  // Create SDK
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] || 'development',
    }),
    traceExporter: jaegerExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable some instrumentations that might be too verbose
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-net': {
          enabled: false,
        },
      }),
    ],
  });

  // Initialize the SDK
  sdk.start();

  logger.info('OpenTelemetry tracing initialized', {
    serviceName,
    serviceVersion,
    jaegerEndpoint: jaegerEndpoint || 'http://localhost:14268/api/traces',
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => logger.info('Tracing SDK shut down successfully'))
      .catch((error) => logger.error('Error shutting down tracing SDK', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}
