import { ExpressionEvaluator } from '../utils/expression-evaluator';
import { PluginRegistry } from '../plugins/plugin-registry';
import {
  PolicyConfig,
  PolicyAlert,
  EvaluationContext,
  PolicyEvaluationResult,
} from '../types/policy';

export class PolicyEngine {
  private policies: PolicyAlert[] = [];
  private evaluator: ExpressionEvaluator;
  private pluginRegistry: PluginRegistry;
  private settings: any = {};

  constructor(pluginRegistry: PluginRegistry) {
    this.evaluator = new ExpressionEvaluator();
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Load policies from configuration
   */
  loadPolicies(config: PolicyConfig): void {
    // Validate policies
    const validPolicies = config.alerts.filter((policy) => {
      const isValid = this.evaluator.validate(policy.when);
      if (!isValid) {
        console.warn(`Invalid policy expression: ${policy.id} - ${policy.when}`);
      }
      return isValid;
    });

    this.policies = validPolicies;
    this.settings = config.settings || {};

    console.log(`Loaded ${this.policies.length} policies`);
  }

  /**
   * Evaluate all policies against a context
   */
  async evaluate(context: EvaluationContext): Promise<PolicyEvaluationResult[]> {
    const results: PolicyEvaluationResult[] = [];
    const timeout = this.settings.evaluation_timeout || 10000;

    for (const policy of this.policies) {
      const startTime = Date.now();

      try {
        // Evaluate policy condition with timeout
        const matched = await this.evaluateWithTimeout(
          () => this.evaluator.evaluate(policy.when, context),
          timeout
        );

        const result: PolicyEvaluationResult = {
          policyId: policy.id,
          matched,
          executionTime: Date.now() - startTime,
        };

        if (matched) {
          result.actions = policy.actions;

          // Execute actions if parallel evaluation is enabled
          if (this.settings.parallel_evaluation) {
            await this.executeActions(context, policy.actions);
          }
        }

        results.push(result);
      } catch (error) {
        results.push({
          policyId: policy.id,
          matched: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
        });
      }
    }

    // Execute actions sequentially if parallel evaluation is disabled
    if (!this.settings.parallel_evaluation) {
      for (const result of results) {
        if (result.matched && result.actions) {
          await this.executeActions(context, result.actions);
        }
      }
    }

    return results;
  }

  /**
   * Execute policy actions
   */
  private async executeActions(context: EvaluationContext, actions: any[]): Promise<void> {
    for (const action of actions) {
      try {
        await this.pluginRegistry.execute(action.type, context, action);
      } catch (error) {
        console.error(`Action execution failed: ${action.type}`, error);
        // Continue with other actions even if one fails
      }
    }
  }

  /**
   * Evaluate with timeout
   */
  private async evaluateWithTimeout<T>(fn: () => T, timeoutMs: number): Promise<T> {
    return Promise.race([
      Promise.resolve(fn()),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Evaluation timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Get current policies
   */
  getPolicies(): PolicyAlert[] {
    return [...this.policies];
  }

  /**
   * Get policy by ID
   */
  getPolicy(id: string): PolicyAlert | undefined {
    return this.policies.find((p) => p.id === id);
  }

  /**
   * Get policy statistics
   */
  getStats(): any {
    return {
      totalPolicies: this.policies.length,
      settings: this.settings,
      plugins: this.pluginRegistry.list(),
    };
  }
}
