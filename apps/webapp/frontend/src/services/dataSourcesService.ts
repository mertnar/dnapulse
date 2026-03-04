import type {
  DataSource,
  DataModelDetail,
  SampleEvent,
  DataSourceError,
  SchemaChange,
  AuditLog,
} from '../types';

const mockDataSources: DataSource[] = [
  {
    id: 'ds-1',
    organization_id: 'org-1',
    name: 'Production API Agents',
    type: 'Agent',
    status: 'active',
    throughput: 5600,
    latencyP95: 45,
    last_seen: new Date(Date.now() - 30000).toISOString(),
    model_id: 'model-1',
    drift_status: 'none',
    connection_config: {
      transport: 'grpc',
      mtls_enabled: true,
      enrollment_token: 'tk_prod_abc123xyz',
    },
    pipeline_config: {
      steps: [
        { id: 'step-1', type: 'parse', enabled: true, config: {} },
        { id: 'step-2', type: 'normalize', enabled: true, config: {} },
      ],
      mappings: [],
    },
    config: {},
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ds-2',
    organization_id: 'org-1',
    name: 'ELK Security Logs',
    type: 'ELK/Elastic',
    status: 'active',
    throughput: 3200,
    latencyP95: 120,
    last_seen: new Date(Date.now() - 60000).toISOString(),
    model_id: 'model-2',
    drift_status: 'detected',
    connection_config: {
      cluster_url: 'https://elk.company.com:9200',
      auth_method: 'api_key',
      index_pattern: 'security-logs-*',
      time_field: '@timestamp',
    },
    pipeline_config: null,
    config: {},
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ds-3',
    organization_id: 'org-1',
    name: 'Webhook Endpoint',
    type: 'API/Webhook',
    status: 'degraded',
    throughput: 850,
    latencyP95: 220,
    last_seen: new Date(Date.now() - 300000).toISOString(),
    model_id: null,
    drift_status: 'none',
    connection_config: {
      endpoint_url: 'https://ingest.dnapulse.io/webhook/w_abc123',
      secret_token: 'whsec_abcd1234efgh5678',
      content_type: 'application/json',
    },
    pipeline_config: null,
    config: {},
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ds-4',
    organization_id: 'org-1',
    name: 'IoT Sensor Network',
    type: 'Network/IoT Stream',
    status: 'error',
    throughput: 0,
    latencyP95: 0,
    last_seen: new Date(Date.now() - 3600000).toISOString(),
    model_id: 'model-3',
    drift_status: 'none',
    connection_config: {
      protocol: 'MQTT',
      broker_url: 'mqtt://iot-broker.company.com:1883',
      topic: 'sensors/telemetry/#',
      auth_method: 'username_password',
    },
    pipeline_config: null,
    config: {},
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ds-5',
    organization_id: 'org-1',
    name: 'Custom Python SDK',
    type: 'Custom SDK',
    status: 'disabled',
    throughput: 0,
    latencyP95: 0,
    last_seen: new Date(Date.now() - 7200000).toISOString(),
    model_id: null,
    drift_status: 'none',
    connection_config: {
      language: 'python',
      api_key: 'sdk_py_xyz789abc',
    },
    pipeline_config: null,
    config: {},
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockDataModels: DataModelDetail[] = [
  {
    id: 'model-1',
    organization_id: 'org-1',
    name: 'Agent Telemetry v2',
    version: 2,
    source_id: 'ds-1',
    fields: [
      {
        name: 'timestamp',
        type: 'date',
        required: true,
        example: '2026-01-08T10:30:00Z',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'agent_id',
        type: 'string',
        required: true,
        example: 'agent-prod-01',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'event_type',
        type: 'string',
        required: true,
        example: 'process.start',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'severity',
        type: 'string',
        required: true,
        example: 'high',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'process_name',
        type: 'string',
        required: false,
        example: 'nginx',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'cpu_usage',
        type: 'number',
        required: false,
        example: 45.2,
        last_seen: new Date().toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'model-2',
    organization_id: 'org-1',
    name: 'Security Logs',
    version: 1,
    source_id: 'ds-2',
    fields: [
      {
        name: '@timestamp',
        type: 'date',
        required: true,
        example: '2026-01-08T10:30:00Z',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'event.action',
        type: 'string',
        required: true,
        example: 'authentication_success',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'user.name',
        type: 'string',
        required: true,
        example: 'john.doe',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'source.ip',
        type: 'string',
        required: true,
        example: '192.168.1.100',
        last_seen: new Date().toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'model-3',
    organization_id: 'org-1',
    name: 'IoT Sensor Data',
    version: 1,
    source_id: 'ds-4',
    fields: [
      {
        name: 'timestamp',
        type: 'date',
        required: true,
        example: '2026-01-08T10:30:00Z',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'sensor_id',
        type: 'string',
        required: true,
        example: 'sensor-floor-1-temp',
        last_seen: new Date().toISOString(),
      },
      {
        name: 'temperature',
        type: 'number',
        required: true,
        example: 22.5,
        last_seen: new Date().toISOString(),
      },
      {
        name: 'humidity',
        type: 'number',
        required: true,
        example: 65.2,
        last_seen: new Date().toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockSampleEvents: SampleEvent[] = [
  {
    id: 'evt-1',
    source_id: 'ds-1',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    severity: 'high',
    raw: {
      timestamp: '2026-01-08T10:30:00Z',
      agent_id: 'agent-prod-01',
      event_type: 'process.start',
      severity: 'high',
      process_name: 'suspicious.exe',
    },
    parsed: {
      timestamp: new Date(Date.now() - 120000).toISOString(),
      agent_id: 'agent-prod-01',
      event_type: 'process.start',
      severity: 'high',
      process_name: 'suspicious.exe',
    },
  },
];

const mockSchemaChanges: Record<string, SchemaChange[]> = {
  'ds-2': [
    {
      field_name: 'user.email',
      change_type: 'added',
      new_type: 'string',
      detected_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      field_name: 'event.duration',
      change_type: 'added',
      new_type: 'number',
      detected_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
};

const mockDataSourceErrors: DataSourceError[] = [
  {
    id: 'err-1',
    source_id: 'ds-4',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    error_type: 'connection_timeout',
    message: 'Failed to connect to MQTT broker',
    details: { broker_url: 'mqtt://iot-broker.company.com:1883' },
  },
  {
    id: 'err-2',
    source_id: 'ds-4',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    error_type: 'authentication_failed',
    message: 'Invalid credentials',
    details: {},
  },
];

const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    organization_id: 'org-1',
    user_id: 'user-1',
    action: 'data_source.created',
    resource_type: 'data_source',
    resource_id: 'ds-1',
    before_state: null,
    after_state: { name: 'Production API Agents', type: 'Agent', status: 'active' },
    ip_address: '192.168.1.100',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'audit-2',
    organization_id: 'org-1',
    user_id: 'user-1',
    action: 'data_source.status_changed',
    resource_type: 'data_source',
    resource_id: 'ds-5',
    before_state: { status: 'active' },
    after_state: { status: 'disabled' },
    ip_address: '192.168.1.100',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

import { api } from '../lib/api.js';

export const dataSourcesService = {
  async getDataSources(): Promise<DataSource[]> {
    return api.get<DataSource[]>('/data-sources');
  },

  async getDataSourceById(id: string): Promise<DataSource | undefined> {
    try {
      return await api.get<DataSource>(`/data-sources/${id}`);
    } catch (error) {
      return undefined;
    }
  },

  async createDataSource(dataSource: Omit<DataSource, 'id' | 'created_at'>): Promise<DataSource> {
    return api.post<DataSource>('/data-sources', dataSource);
  },

  async updateDataSource(id: string, updates: Partial<DataSource>): Promise<DataSource> {
    return api.put<DataSource>(`/data-sources/${id}`, updates);
  },

  async deleteDataSource(id: string): Promise<void> {
    return api.delete<void>(`/data-sources/${id}`);
  },

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(`/data-sources/${id}/test-connection`);
  },

  async runDiscovery(id: string): Promise<DataModelDetail> {
    return api.post<DataModelDetail>(`/data-sources/${id}/discovery`);
  },

  async getDataModel(sourceId: string): Promise<DataModelDetail | undefined> {
    try {
      return await api.get<DataModelDetail>(`/data-sources/${sourceId}/model`);
    } catch (error) {
      return undefined;
    }
  },

  async getSampleEvents(sourceId: string): Promise<SampleEvent[]> {
    return api.get<SampleEvent[]>(`/data-sources/${sourceId}/sample-events`);
  },

  async getSchemaChanges(sourceId: string): Promise<SchemaChange[]> {
    return api.get<SchemaChange[]>(`/data-sources/${sourceId}/schema-changes`);
  },

  async acceptSchemaChanges(sourceId: string): Promise<void> {
    return api.post<void>(`/data-sources/${sourceId}/schema-changes/accept`);
  },

  async getErrors(sourceId: string): Promise<DataSourceError[]> {
    return api.get<DataSourceError[]>(`/data-sources/${sourceId}/errors`);
  },

  async getAuditLogs(sourceId: string): Promise<AuditLog[]> {
    return api.get<AuditLog[]>(`/data-sources/${sourceId}/audit-logs`);
  },

  async sendTestEvent(sourceId: string): Promise<SampleEvent> {
    return api.post<SampleEvent>(`/data-sources/${sourceId}/test-event`);
  },

  async simulateDrift(sourceId: string): Promise<void> {
    return api.post<void>(`/data-sources/${sourceId}/simulate-drift`);
  },
};
