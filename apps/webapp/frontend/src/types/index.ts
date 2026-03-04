export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export type DataSourceType =
  | 'Agent'
  | 'ELK/Elastic'
  | 'API/Webhook'
  | 'Custom SDK'
  | 'Network/IoT Stream';
export type DataSourceStatus = 'active' | 'degraded' | 'error' | 'disabled';
export type DriftStatus = 'none' | 'detected';

export interface DataSource {
  id: string;
  organization_id: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  throughput: number;
  latencyP95: number;
  last_seen: string;
  model_id: string | null;
  drift_status: DriftStatus;
  connection_config: Record<string, any>;
  pipeline_config: PipelineConfig | null;
  config: Record<string, any>;
  created_at: string;
}

export interface PipelineConfig {
  steps: PipelineStep[];
  mappings: FieldMapping[];
}

export interface PipelineStep {
  id: string;
  type: 'parse' | 'normalize' | 'enrich' | 'mask' | 'route';
  enabled: boolean;
  config: Record<string, any>;
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  transformation?: 'lowercase' | 'uppercase' | 'regex_extract' | 'numeric_cast' | 'trim';
  transformation_config?: Record<string, any>;
}

export interface DataModelField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  example: any;
  last_seen: string;
}

export interface DataModelDetail {
  id: string;
  organization_id: string;
  name: string;
  version: number;
  source_id: string | null;
  fields: DataModelField[];
  created_at: string;
}

export interface SampleEvent {
  id: string;
  source_id: string;
  timestamp: string;
  severity: EventSeverity;
  raw: Record<string, any>;
  parsed: Record<string, any> | null;
}

export interface SchemaChange {
  field_name: string;
  change_type: 'added' | 'removed' | 'type_changed';
  old_type?: string;
  new_type?: string;
  detected_at: string;
}

export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Event {
  id: string;
  organization_id: string;
  source_id: string;
  event_type: string;
  severity: EventSeverity;
  payload: Record<string, any>;
  tenant: string | null;
  tags: string[];
  timestamp: string;
}

export type RuleOutputType = 'Alert' | 'Metric' | 'New Data Model';

export interface Rule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  query: string;
  schedule: string;
  severity: EventSeverity;
  output_type: RuleOutputType;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  match_count: number;
  created_at: string;
}

export type AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';

export interface Alert {
  id: string;
  organization_id: string;
  rule_id: string | null;
  source_id: string | null;
  severity: EventSeverity;
  status: AlertStatus;
  title: string;
  description: string | null;
  related_events: any[];
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type InvestigationStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface Investigation {
  id: string;
  organization_id: string;
  title: string;
  owner_id: string | null;
  status: InvestigationStatus;
  time_range_start: string | null;
  time_range_end: string | null;
  related_alert_ids: string[];
  notes_count: number;
  created_at: string;
}

export interface InvestigationNote {
  id: string;
  investigation_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
}

export type AgentStatus = 'active' | 'inactive' | 'error';

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  version: string;
  status: AgentStatus;
  deployed_endpoints: number;
  data_types: string[];
  config: Record<string, any>;
  created_at: string;
}

export type DataModelType = 'auto-discovered' | 'derived' | 'composite' | 'vector';
export type ModelStatus = 'active' | 'undefined-fields' | 'drift-detected' | 'deprecated';
export type AttributeStatus = 'normal' | 'undefined' | 'derived' | 'deprecated';
export type JoinType = 'inner' | 'left' | 'right';
export type FunctionType = 'concat' | 'substring' | 'regex' | 'math' | 'conditional';
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface DataModel {
  id: string;
  organization_id: string;
  name: string;
  type: DataModelType;
  schema: Record<string, any>;
  source_models: string[];
  created_at: string;
}

export interface DataModelExtended {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  type: DataModelType;
  status: ModelStatus;
  version: number;
  tags: string[];
  owner: string;
  source_count: number;
  agent_count: number;
  attributes: ModelAttribute[];
  source_models: string[];
  created_at: string;
  updated_at: string;
  ml_ready: boolean;
  rule_ready: boolean;
}

export interface ModelAttribute {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'vector';
  source_model?: string;
  example_value: any;
  indexed: boolean;
  description: string;
  status: AttributeStatus;
  required: boolean;
  derivation?: AttributeDerivation;
  order: number;
}

export interface AttributeDerivation {
  function_type: FunctionType;
  expression: string;
  source_attributes: string[];
}

export interface ModelVersion {
  version: number;
  created_at: string;
  created_by: string;
  changes: string[];
  schema_diff: SchemaDiff;
}

export interface SchemaDiff {
  added: string[];
  removed: string[];
  modified: Array<{
    field: string;
    old_type: string;
    new_type: string;
  }>;
}

export interface ModelComposition {
  id: string;
  base_model_id: string;
  join_model_id: string;
  join_type: JoinType;
  join_keys: JoinKey[];
  attribute_mapping: Record<string, string>;
}

export interface JoinKey {
  base_key: string;
  join_key: string;
}

export interface ModelLineageNode {
  id: string;
  name: string;
  type: 'agent' | 'data-source' | 'model' | 'rule' | 'alert' | 'ml-pipeline';
  status: string;
}

export interface ModelLineage {
  sources: ModelLineageNode[];
  consumers: ModelLineageNode[];
  relationships: Array<{
    from: string;
    to: string;
  }>;
}

export interface ModelNote {
  id: string;
  model_id: string;
  attribute_name?: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface ModelUsage {
  rules: Array<{ id: string; name: string; usage_count: number }>;
  alerts_triggered: number;
  investigations: Array<{ id: string; title: string }>;
  ml_pipelines: Array<{ id: string; name: string; status: string }>;
}

export interface ModelContributor {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  contributions: number;
  last_contribution: string;
}

export interface DataSampleRecord {
  id: string;
  timestamp: string;
  raw: Record<string, any>;
  processed: Record<string, any>;
}

export interface DataSourceError {
  id: string;
  source_id: string;
  timestamp: string;
  error_type: string;
  message: string;
  details: Record<string, any>;
}

export type MLModelType = 'anomaly' | 'classification' | 'nlp' | 'vector';
export type MLModelStatus = 'research' | 'trained' | 'validated' | 'deployed' | 'deprecated';
export type DeploymentStatus = 'running' | 'stopped' | 'error';
export type LearningType = 'supervised' | 'unsupervised' | 'semi-supervised' | 'reinforcement';
export type InferenceMode = 'real-time' | 'batch' | 'query-based';

export interface MLModel {
  id: string;
  organization_id: string;
  name: string;
  type: MLModelType;
  version: string;
  status: MLModelStatus;
  last_trained: string | null;
  config: Record<string, any>;
  created_at: string;
}

export interface MLModelExtended {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  problem_statement: string;
  type: MLModelType;
  learning_type: LearningType;
  inference_mode: InferenceMode;
  status: MLModelStatus;
  deployment_status: DeploymentStatus;
  version: string;
  created_at: string;
  updated_at: string;
  last_trained: string | null;

  research_notebook_url?: string;
  repository_url?: string;
  microservice_endpoint?: string;

  owner: string;
  reviewers: string[];
  tags: string[];
}

export interface MLModelInputOutput {
  required_data_models: string[];
  features: MLFeature[];
  output_type: 'score' | 'label' | 'anomaly_flag' | 'embedding' | 'probability';
  output_schema: Record<string, any>;
  example_request: Record<string, any>;
  example_response: Record<string, any>;
}

export interface MLFeature {
  name: string;
  type: string;
  required: boolean;
  description: string;
  transformation?: string;
}

export interface MLTrainingDetails {
  dataset_description: string;
  dataset_sources: string[];
  time_range_start: string;
  time_range_end: string;
  data_volume: number;
  labeling_method?: string;
  training_environment: string;

  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    loss?: number;
  };

  training_duration: string;
  notes: string;
}

export interface MLValidationMetrics {
  test_dataset_description: string;
  evaluation_date: string;

  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    auc_roc?: number;
  };

  confusion_matrix?: number[][];
  threshold_config?: Record<string, any>;
  known_limitations: string[];
  validation_notes: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
}

export interface MLDeployment {
  microservice_name: string;
  version: string;
  endpoint: string;
  deployment_mode: InferenceMode;

  resources: {
    cpu: string;
    ram: string;
    gpu?: string;
  };

  scaling_strategy: string;
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  uptime_percentage: number;

  usage_guide_url?: string;
  api_spec_url?: string;
}

export interface MLRuntimeMetrics {
  inference_count_24h: number;
  inference_count_7d: number;
  average_latency_ms: number;
  error_rate: number;
  last_prediction_time: string;
  drift_detected: boolean;

  used_by_rules: Array<{ id: string; name: string }>;
  used_by_alerts: number;
  used_in_investigations: Array<{ id: string; title: string }>;
}

export interface MLModelVersionHistory {
  version: string;
  created_at: string;
  created_by: string;
  changes: string[];
  metric_comparison?: {
    accuracy_delta?: number;
    precision_delta?: number;
    recall_delta?: number;
  };
  schema_changes: string[];
  deprecated: boolean;
  deprecation_reason?: string;
}

export interface MLGovernanceNote {
  id: string;
  model_id: string;
  content: string;
  category: 'assumption' | 'risk' | 'compliance' | 'general';
  author: string;
  created_at: string;
  updated_at: string;
}

export interface LifecyclePolicy {
  id: string;
  organization_id: string;
  name: string;
  hot_retention_days: number;
  medium_retention_days: number;
  cold_retention_days: number;
  data_type: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  permissions: Record<string, any>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface KPIData {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface FilterOption {
  label: string;
  value: string;
}
