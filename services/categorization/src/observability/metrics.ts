import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { Logger } from 'pino';

export interface MetricsOptions {
  serviceName: string;
  logger: Logger;
}

export class MetricsCollector {
  private logger: Logger;
  private serviceName: string;

  // Counters
  public readonly itemsProcessed: Counter<string>;
  public readonly labelsAssigned: Counter<string>;
  public readonly pipelineExecutions: Counter<string>;
  public readonly errors: Counter<string>;

  // Histograms
  public readonly processingLatency: Histogram<string>;
  public readonly pipelineLatency: Histogram<string>;
  public readonly apiLatency: Histogram<string>;

  // Gauges
  public readonly activeConfigVersion: Gauge<string>;
  public readonly pipelineCount: Gauge<string>;

  constructor(options: MetricsOptions) {
    this.serviceName = options.serviceName;
    this.logger = options.logger;

    // Initialize default metrics
    collectDefaultMetrics({
      prefix: 'dna_categorization_',
    });

    // Define counters
    this.itemsProcessed = new Counter({
      name: 'dna_categorization_items_processed_total',
      help: 'Total number of items processed',
      labelNames: ['status', 'cardinality'],
    });

    this.labelsAssigned = new Counter({
      name: 'dna_categorization_labels_assigned_total',
      help: 'Total number of labels assigned',
      labelNames: ['label_kind', 'pipeline'],
    });

    this.pipelineExecutions = new Counter({
      name: 'dna_categorization_pipeline_executions_total',
      help: 'Total number of pipeline executions',
      labelNames: ['pipeline', 'status'],
    });

    this.errors = new Counter({
      name: 'dna_categorization_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'component'],
    });

    // Define histograms
    this.processingLatency = new Histogram({
      name: 'dna_categorization_processing_duration_seconds',
      help: 'Time spent processing items',
      labelNames: ['status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.pipelineLatency = new Histogram({
      name: 'dna_categorization_pipeline_duration_seconds',
      help: 'Time spent executing pipelines',
      labelNames: ['pipeline'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.apiLatency = new Histogram({
      name: 'dna_categorization_api_duration_seconds',
      help: 'Time spent handling API requests',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    // Define gauges
    this.activeConfigVersion = new Gauge({
      name: 'dna_categorization_config_version',
      help: 'Current configuration version',
    });

    this.pipelineCount = new Gauge({
      name: 'dna_categorization_pipeline_count',
      help: 'Number of active pipelines',
    });

    this.logger.info('Prometheus metrics initialized', { serviceName: this.serviceName });
  }

  // Helper methods for common operations
  recordItemProcessed(status: 'success' | 'error', cardinality: string): void {
    this.itemsProcessed.inc({ status, cardinality });
  }

  recordLabelsAssigned(labelKind: string, pipeline: string, count: number = 1): void {
    this.labelsAssigned.inc({ label_kind: labelKind, pipeline }, count);
  }

  recordPipelineExecution(pipeline: string, status: 'success' | 'error'): void {
    this.pipelineExecutions.inc({ pipeline, status });
  }

  recordError(errorType: string, component: string): void {
    this.errors.inc({ error_type: errorType, component });
  }

  recordProcessingTime(status: 'success' | 'error', duration: number): void {
    this.processingLatency.observe({ status }, duration);
  }

  recordPipelineTime(pipeline: string, duration: number): void {
    this.pipelineLatency.observe({ pipeline }, duration);
  }

  recordApiTime(method: string, route: string, statusCode: number, duration: number): void {
    this.apiLatency.observe({ method, route, status_code: statusCode.toString() }, duration);
  }

  updateConfigVersion(version: string): void {
    // Convert version string to a timestamp hash for metrics
    const versionHash = version.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    this.activeConfigVersion.set(versionHash);
  }

  updatePipelineCount(count: number): void {
    this.pipelineCount.set(count);
  }

  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Clear all metrics (useful for testing)
  clearMetrics(): void {
    register.clear();
  }
}
