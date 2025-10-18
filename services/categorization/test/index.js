'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.testEnv = exports.testData = void 0;
const dotenv_1 = require('dotenv');
(0, dotenv_1.config)();
exports.testData = {
  mockItem: {
    id: 'test-item-1',
    tenant_id: 'tenant-1',
    type: 'metric',
    ts: '2024-01-15T10:30:00Z',
    payload: {
      cpu_load: 0.95,
      memory_usage: 0.78,
      process_name: 'nginx',
    },
    attributes: {
      host: 'web-server-01',
      level: 'warn',
    },
  },
  mockConfig: {
    version: 1,
    cardinality: 'one_to_many',
    label_kind: 'category',
    default_label: 'uncategorized',
    targets: {
      selector: 'type === "metric" || type === "log"',
      item_types: ['metric', 'log'],
    },
    pipelines: [
      {
        name: 'high_cpu_detector',
        labeler: 'rule_based',
        enabled: true,
        priority: 10,
        args: {
          rules: [
            {
              when: 'payload.cpu_load > 0.9',
              label: 'high_cpu',
              score: 0.95,
            },
          ],
        },
      },
    ],
    persistence: {
      mongodb: {
        enabled: true,
        collection: 'item_labels',
      },
      elasticsearch: {
        enabled: false,
        index: 'categorized-items',
      },
    },
  },
};
exports.testEnv = {
  PORT: '8083',
  HOST: 'localhost',
  CONFIG_URL: 'http://localhost:8084',
  CONFIG_SCOPE: 'categorization',
  MONGO_URI: 'mongodb://localhost:27017',
  MONGO_DATABASE: 'categorization_test',
  ELASTICSEARCH_NODE: 'http://localhost:9200',
  ELASTICSEARCH_INDEX: 'categorized-items-test',
  JAEGER_ENDPOINT: 'http://localhost:14268/api/traces',
  BYPASS_AUTH: 'true',
  LOG_LEVEL: 'silent',
};
//# sourceMappingURL=index.js.map
