import type {
  Organization,
  User,
  DataSource,
  Event,
  Rule,
  Alert,
  Investigation,
  Agent,
  DataModel,
  MLModel,
  LifecyclePolicy,
  Role,
  AuditLog,
  KPIData,
} from '../types';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

export const mockOrganization: Organization = {
  id: ORG_ID,
  name: 'Acme Corporation',
  created_at: new Date().toISOString(),
};

export const mockUsers: User[] = [
  {
    id: USER_ID,
    email: 'admin@acme.com',
    full_name: 'John Administrator',
    organization_id: ORG_ID,
    role: 'admin',
    avatar_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-2',
    email: 'analyst@acme.com',
    full_name: 'Sarah Analyst',
    organization_id: ORG_ID,
    role: 'analyst',
    avatar_url: null,
    created_at: new Date().toISOString(),
  },
];

export const mockDataSources: DataSource[] = [
  {
    id: 'ds-1',
    organization_id: ORG_ID,
    name: 'Production API Gateway',
    type: 'API/Webhook',
    status: 'active',
    throughput: 1250,
    last_seen: new Date().toISOString(),
    config: { endpoint: 'https://api.acme.com' },
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ds-2',
    organization_id: ORG_ID,
    name: 'Elasticsearch Cluster',
    type: 'ELK/Elastic',
    status: 'active',
    throughput: 3420,
    last_seen: new Date().toISOString(),
    config: { hosts: ['elastic-1.acme.com', 'elastic-2.acme.com'] },
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ds-3',
    organization_id: ORG_ID,
    name: 'IoT Sensors Network',
    type: 'Network/IoT Stream',
    status: 'active',
    throughput: 890,
    last_seen: new Date().toISOString(),
    config: { protocol: 'MQTT' },
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ds-4',
    organization_id: ORG_ID,
    name: 'Legacy System Connector',
    type: 'Custom SDK',
    status: 'error',
    throughput: 0,
    last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    config: {},
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockEvents: Event[] = Array.from({ length: 50 }, (_, i) => ({
  id: `evt-${i}`,
  organization_id: ORG_ID,
  source_id: mockDataSources[i % mockDataSources.length].id,
  event_type: ['login', 'api_call', 'error', 'data_sync', 'alert'][i % 5],
  severity: ['info', 'low', 'medium', 'high', 'critical'][i % 5] as Event['severity'],
  payload: {
    user_id: `user-${i % 10}`,
    action: 'sample_action',
    details: `Event details for event ${i}`,
    metadata: { source: 'mock', index: i },
  },
  tenant: `tenant-${i % 3}`,
  tags: [`tag-${i % 5}`, `category-${i % 3}`],
  timestamp: new Date(Date.now() - i * 60000).toISOString(),
}));

export const mockRules: Rule[] = [
  {
    id: 'rule-1',
    organization_id: ORG_ID,
    name: 'High Error Rate Detection',
    description: 'Triggers when error rate exceeds 5% in 5 minutes',
    query: 'severity:error AND rate > 0.05',
    schedule: '*/5 * * * *',
    severity: 'high',
    output_type: 'Alert',
    enabled: true,
    last_run: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    next_run: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    match_count: 23,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rule-2',
    organization_id: ORG_ID,
    name: 'Anomalous Login Pattern',
    description: 'Detects unusual login patterns',
    query: 'event_type:login AND anomaly_score > 0.8',
    schedule: '*/15 * * * *',
    severity: 'critical',
    output_type: 'Alert',
    enabled: true,
    last_run: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    next_run: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    match_count: 7,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rule-3',
    organization_id: ORG_ID,
    name: 'API Response Time',
    description: 'Monitor API response times',
    query: 'response_time > 2000',
    schedule: '*/10 * * * *',
    severity: 'medium',
    output_type: 'Metric',
    enabled: true,
    last_run: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    next_run: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    match_count: 145,
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    organization_id: ORG_ID,
    rule_id: 'rule-1',
    source_id: 'ds-1',
    severity: 'critical',
    status: 'new',
    title: 'Critical: High error rate detected in Production API',
    description: 'Error rate has exceeded 5% threshold for the past 10 minutes',
    related_events: [],
    assigned_to: null,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    resolved_at: null,
  },
  {
    id: 'alert-2',
    organization_id: ORG_ID,
    rule_id: 'rule-2',
    source_id: 'ds-2',
    severity: 'high',
    status: 'acknowledged',
    title: 'Suspicious login from unusual location',
    description: 'Multiple failed login attempts detected',
    related_events: [],
    assigned_to: USER_ID,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
  },
  {
    id: 'alert-3',
    organization_id: ORG_ID,
    rule_id: 'rule-1',
    source_id: 'ds-3',
    severity: 'medium',
    status: 'resolved',
    title: 'IoT sensor connectivity issue',
    description: 'Sensor network experienced intermittent connectivity',
    related_events: [],
    assigned_to: 'user-2',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockInvestigations: Investigation[] = [
  {
    id: 'inv-1',
    organization_id: ORG_ID,
    title: 'Production API Outage Investigation',
    owner_id: USER_ID,
    status: 'investigating',
    time_range_start: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    time_range_end: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    related_alert_ids: ['alert-1', 'alert-3'],
    notes_count: 5,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inv-2',
    organization_id: ORG_ID,
    title: 'Security Incident - Unauthorized Access Attempt',
    owner_id: 'user-2',
    status: 'open',
    time_range_start: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    time_range_end: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    related_alert_ids: ['alert-2'],
    notes_count: 3,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    organization_id: ORG_ID,
    name: 'System Metrics Collector',
    version: '2.1.0',
    status: 'active',
    deployed_endpoints: 45,
    data_types: ['cpu_usage', 'memory', 'disk_io', 'network'],
    config: { interval: 60, compression: true },
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'agent-2',
    organization_id: ORG_ID,
    name: 'Application Log Aggregator',
    version: '1.5.2',
    status: 'active',
    deployed_endpoints: 32,
    data_types: ['application_logs', 'error_traces', 'performance_metrics'],
    config: { buffer_size: 1024, batch_interval: 30 },
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'agent-3',
    organization_id: ORG_ID,
    name: 'Security Event Monitor',
    version: '3.0.1',
    status: 'active',
    deployed_endpoints: 18,
    data_types: ['auth_events', 'access_logs', 'security_alerts'],
    config: { realtime: true, alert_threshold: 'high' },
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockDataModels: DataModel[] = [
  {
    id: 'model-1',
    organization_id: ORG_ID,
    name: 'User Activity Model',
    type: 'base',
    schema: {
      fields: [
        { name: 'user_id', type: 'string' },
        { name: 'action', type: 'string' },
        { name: 'timestamp', type: 'datetime' },
      ],
    },
    source_models: [],
    created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'model-2',
    organization_id: ORG_ID,
    name: 'Aggregated User Sessions',
    type: 'derived',
    schema: {
      fields: [
        { name: 'user_id', type: 'string' },
        { name: 'session_count', type: 'integer' },
        { name: 'total_duration', type: 'integer' },
      ],
    },
    source_models: ['model-1'],
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockMLModels: MLModel[] = [
  {
    id: 'ml-1',
    organization_id: ORG_ID,
    name: 'Anomaly Detection - API Traffic',
    type: 'anomaly',
    version: '2.0.0',
    status: 'ready',
    last_trained: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    config: { algorithm: 'isolation_forest', sensitivity: 0.85 },
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ml-2',
    organization_id: ORG_ID,
    name: 'Security Threat Classifier',
    type: 'classification',
    version: '1.3.0',
    status: 'ready',
    last_trained: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    config: { algorithm: 'random_forest', classes: ['benign', 'suspicious', 'malicious'] },
    created_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockLifecyclePolicies: LifecyclePolicy[] = [
  {
    id: 'policy-1',
    organization_id: ORG_ID,
    name: 'Default Retention Policy',
    hot_retention_days: 7,
    medium_retention_days: 30,
    cold_retention_days: 365,
    data_type: null,
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'policy-2',
    organization_id: ORG_ID,
    name: 'Security Logs Extended Retention',
    hot_retention_days: 30,
    medium_retention_days: 90,
    cold_retention_days: 2555,
    data_type: 'security_logs',
    created_at: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockRoles: Role[] = [
  {
    id: 'role-1',
    organization_id: ORG_ID,
    name: 'Administrator',
    permissions: {
      data_sources: ['read', 'write', 'delete'],
      rules: ['read', 'write', 'delete'],
      alerts: ['read', 'write', 'delete'],
      users: ['read', 'write', 'delete'],
    },
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'role-2',
    organization_id: ORG_ID,
    name: 'Analyst',
    permissions: {
      data_sources: ['read'],
      rules: ['read', 'write'],
      alerts: ['read', 'write'],
      users: ['read'],
    },
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockAuditLogs: AuditLog[] = Array.from({ length: 20 }, (_, i) => ({
  id: `audit-${i}`,
  organization_id: ORG_ID,
  user_id: i % 2 === 0 ? USER_ID : 'user-2',
  action: ['create', 'update', 'delete', 'view'][i % 4],
  resource_type: ['rule', 'alert', 'data_source', 'user'][i % 4],
  resource_id: `resource-${i}`,
  before_state: i % 4 === 1 ? { status: 'old' } : null,
  after_state: i % 4 === 1 ? { status: 'new' } : null,
  ip_address: `192.168.1.${i + 1}`,
  created_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
}));

export const mockKPIs: KPIData[] = [
  { label: 'Ingestion Rate', value: '5,560/s', change: 12.5, trend: 'up' },
  { label: 'Active Agents', value: '95', change: 2, trend: 'up' },
  { label: 'Alerts (24h)', value: '23', change: -15, trend: 'down' },
  { label: 'Data Latency', value: '145ms', change: -8, trend: 'down' },
  { label: 'Storage Usage', value: '68.4TB', change: 5, trend: 'up' },
];
