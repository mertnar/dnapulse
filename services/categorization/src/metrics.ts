import { register, Counter, Histogram, Gauge } from 'prom-client';

// Metrics
export const messageCounter = new Counter({
  name: 'categorization_messages_processed_total',
  help: 'Total number of messages processed',
  labelNames: ['status'],
});

export const processingDuration = new Histogram({
  name: 'categorization_processing_duration_seconds',
  help: 'Time spent processing messages',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const rulesEvaluated = new Counter({
  name: 'categorization_rules_evaluated_total',
  help: 'Total number of rules evaluated',
  labelNames: ['rule_id', 'result'],
});

export const labelsGenerated = new Counter({
  name: 'categorization_labels_generated_total',
  help: 'Total number of labels generated',
  labelNames: ['label'],
});

export const activeRules = new Gauge({
  name: 'categorization_active_rules',
  help: 'Number of active rules loaded',
});

export const configReloads = new Counter({
  name: 'categorization_config_reloads_total',
  help: 'Total number of configuration reloads',
});

export const sseConnectionStatus = new Gauge({
  name: 'categorization_sse_connection_status',
  help: 'SSE connection status (1=connected, 0=disconnected)',
});

export function getMetrics(): Promise<string> {
  return register.metrics();
}
