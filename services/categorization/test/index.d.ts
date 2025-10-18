export declare const testData: {
  mockItem: {
    id: string;
    tenant_id: string;
    type: 'metric';
    ts: string;
    payload: {
      cpu_load: number;
      memory_usage: number;
      process_name: string;
    };
    attributes: {
      host: string;
      level: string;
    };
  };
  mockConfig: {
    version: number;
    cardinality: 'one_to_many';
    label_kind: string;
    default_label: string;
    targets: {
      selector: string;
      item_types: string[];
    };
    pipelines: {
      name: string;
      labeler: 'rule_based';
      enabled: boolean;
      priority: number;
      args: {
        rules: {
          when: string;
          label: string;
          score: number;
        }[];
      };
    }[];
    persistence: {
      mongodb: {
        enabled: boolean;
        collection: string;
      };
      elasticsearch: {
        enabled: boolean;
        index: string;
      };
    };
  };
};
export declare const testEnv: {
  PORT: string;
  HOST: string;
  CONFIG_URL: string;
  CONFIG_SCOPE: string;
  MONGO_URI: string;
  MONGO_DATABASE: string;
  ELASTICSEARCH_NODE: string;
  ELASTICSEARCH_INDEX: string;
  JAEGER_ENDPOINT: string;
  BYPASS_AUTH: string;
  LOG_LEVEL: string;
};
//# sourceMappingURL=index.d.ts.map
