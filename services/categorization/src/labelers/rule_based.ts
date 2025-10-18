import { ILabeler } from './interface';
import { Item, AppliedLabel, RuleBasedArgs } from '../model';
import { Parser } from 'expr-eval';

export class RuleBasedLabeler implements ILabeler {
  name(): string {
    return 'rule_based';
  }

  async apply(item: Item, args: RuleBasedArgs): Promise<AppliedLabel[]> {
    const results: AppliedLabel[] = [];

    // Create evaluation context
    const context = {
      payload: item.payload,
      attributes: item.attributes,
      type: item.type,
      tenant_id: item.tenant_id,
      id: item.id,
      ts: item.ts,
    };

    for (const rule of args.rules) {
      try {
        // Evaluate the rule condition
        const parser = new Parser();
        const condition = parser.evaluate(rule.when, context);

        if (condition) {
          results.push({
            kind: 'category', // Default kind, can be overridden
            name: rule.label,
            score: rule.score || 1.0,
            meta: {
              rule: rule.when,
              pipeline: 'rule_based',
            },
          });
        }
      } catch (error) {
        // Log error but continue with other rules
        console.warn(`Rule evaluation failed: ${rule.when}`, error);
      }
    }

    return results;
  }
}
