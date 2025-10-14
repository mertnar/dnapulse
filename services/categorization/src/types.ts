export interface Event {
  event_id: string;
  source: string;
  type: string;
  ts: string;
  attributes: Record<string, string>;
  metric?: {
    name: string;
    value: number;
    unit: string;
  };
  log?: {
    message: string;
    level: string;
  };
}

export interface CategorizationRule {
  id: string;
  name: string;
  condition: string;
  labels: string[];
  priority: number;
  enabled: boolean;
}

export interface CategorizationConfig {
  rules: CategorizationRule[];
  metadata: {
    version: string;
    updated_at: string;
    updated_by: string;
  };
}

export interface EvaluationContext {
  type: string;
  payload: any;
  attributes: Record<string, string>;
  ts: string;
}
