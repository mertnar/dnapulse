export type ItemType = 'log' | 'metric' | 'event' | 'trace';

export type Cardinality = 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';

export interface Item {
  id: string;
  tenant_id: string;
  type: ItemType;
  ts: string; // ISO 8601 timestamp
  payload: Record<string, any>;
  attributes: Record<string, any>;
}

export interface Label {
  id: string;
  kind: string;
  name: string;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppliedLabel {
  kind: string;
  name: string;
  score?: number;
  meta?: Record<string, any>;
}

export interface ItemLabel {
  item_id: string;
  label_id: string;
  kind: string;
  score?: number;
  ts: string;
  created_at: string;
}

export interface LabelAssignment {
  item_id: string;
  labels: AppliedLabel[];
  pipeline_name?: string;
  ts: string;
}

export interface AssignmentRequest {
  items: Item[];
}

export interface AssignmentResponse {
  assignments: LabelAssignment[];
  errors?: Array<{
    item_id: string;
    error: string;
  }>;
}

export interface CategorizationConfig {
  version: string;
  cardinality: Cardinality;
  label_kind: string;
  default_label?: string;
  targets?: {
    selector?: string;
    item_types?: ItemType[];
  };
  pipelines: Pipeline[];
  persistence?: {
    mongodb?: {
      enabled: boolean;
      collection: string;
    };
    elasticsearch?: {
      enabled: boolean;
      index: string;
    };
  };
}

export interface Pipeline {
  name: string;
  labeler: 'rule_based' | 'external_db' | 'ml' | 'user';
  args: Record<string, any>;
  enabled: boolean;
  priority: number;
}

export interface RuleBasedArgs {
  rules: Array<{
    when: string; // Expression
    label: string;
    score?: number;
  }>;
}

export interface ExternalDbArgs {
  lookup_by: string; // Field path like 'payload.field'
  table: string;
}

export interface MLArgs {
  endpoint: string;
  model?: string;
}

export interface UserArgs {
  // No args needed for user labeler
}
