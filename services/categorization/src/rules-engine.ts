import { Parser } from 'expr-eval';
import { CategorizationRule, CategorizationConfig, Event, EvaluationContext } from './types';

export class RulesEngine {
  private rules: CategorizationRule[] = [];
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  loadRules(config: CategorizationConfig): void {
    this.rules = config.rules
      .filter((rule) => rule.enabled)
      .sort((a, b) => a.priority - b.priority); // Lower priority = higher precedence
  }

  evaluateEvent(event: Event): string[] {
    const context = this.createEvaluationContext(event);
    const labels: string[] = [];

    for (const rule of this.rules) {
      try {
        const condition = this.parser.parse(rule.condition);
        const result = condition.evaluate(context as any);

        if (result === true || result === 1) {
          labels.push(...rule.labels);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
        // Continue with other rules even if one fails
      }
    }

    return [...new Set(labels)]; // Remove duplicates
  }

  private createEvaluationContext(event: Event): EvaluationContext {
    return {
      type: event.type,
      payload: event.metric || event.log || {},
      attributes: event.attributes,
      ts: event.ts,
    };
  }

  getRules(): CategorizationRule[] {
    return [...this.rules];
  }

  getRuleCount(): number {
    return this.rules.length;
  }
}
