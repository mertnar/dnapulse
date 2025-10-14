// Policy types for decision engine

export interface PolicyAction {
  type: string;
  [key: string]: any;
}

export interface PolicyAlert {
  id: string;
  when: string;
  actions: PolicyAction[];
}

export interface PolicySettings {
  max_policies?: number;
  evaluation_timeout?: number;
  batch_size?: number;
  parallel_evaluation?: boolean;
}

export interface PolicyConfig {
  alerts: PolicyAlert[];
  settings?: PolicySettings;
  metadata?: {
    version?: string;
    updated_at?: string;
    updated_by?: string;
  };
}

export interface EvaluationContext {
  type: string;
  payload: any;
  attributes?: Record<string, string>;
  ts?: string;
}

export interface ActionPlugin {
  name: string;
  execute(context: EvaluationContext, params: any): Promise<void>;
}

export interface PolicyEvaluationResult {
  policyId: string;
  matched: boolean;
  actions?: PolicyAction[];
  error?: string;
  executionTime?: number;
}

