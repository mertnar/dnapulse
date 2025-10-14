import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsService {
  private configRequests: Counter<string>;
  private configUpdates: Counter<string>;
  private configValidationErrors: Counter<string>;
  private configResponseTime: Histogram<string>;
  private activeSubscribers: Gauge<string>;
  private cacheHitRatio: Gauge<string>;
  private configSize: Histogram<string>;

  constructor() {
    // Collect default metrics
    collectDefaultMetrics();

    // Define custom metrics
    this.configRequests = new Counter({
      name: 'config_requests_total',
      help: 'Total number of config requests',
      labelNames: ['scope', 'method'],
    });

    this.configUpdates = new Counter({
      name: 'config_updates_total',
      help: 'Total number of config updates',
      labelNames: ['scope'],
    });

    this.configValidationErrors = new Counter({
      name: 'config_validation_errors_total',
      help: 'Total number of config validation errors',
      labelNames: ['scope', 'error_type'],
    });

    this.configResponseTime = new Histogram({
      name: 'config_request_duration_seconds',
      help: 'Duration of config requests in seconds',
      labelNames: ['scope', 'method'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.activeSubscribers = new Gauge({
      name: 'config_active_subscribers',
      help: 'Number of active SSE subscribers',
    });

    this.cacheHitRatio = new Gauge({
      name: 'config_cache_hit_ratio',
      help: 'Config cache hit ratio (0-1)',
    });

    this.configSize = new Histogram({
      name: 'config_size_bytes',
      help: 'Size of config documents in bytes',
      labelNames: ['scope'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
    });
  }

  recordConfigRequest(scope: string, method: string): void {
    this.configRequests.inc({ scope, method });
  }

  recordConfigUpdate(scope: string): void {
    this.configUpdates.inc({ scope });
  }

  recordValidationError(scope: string, errorType: string): void {
    this.configValidationErrors.inc({ scope, error_type: errorType });
  }

  startRequestTimer(scope: string, method: string): () => void {
    const timer = this.configResponseTime.startTimer({ scope, method });
    return timer;
  }

  setActiveSubscribers(count: number): void {
    this.activeSubscribers.set(count);
  }

  setCacheHitRatio(ratio: number): void {
    this.cacheHitRatio.set(ratio);
  }

  recordConfigSize(scope: string, size: number): void {
    this.configSize.observe({ scope }, size);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getRegister() {
    return register;
  }
}
