import { ExpressionEvaluator } from '../utils/expression-evaluator';
import { EvaluationContext } from '../types/policy';

describe('ExpressionEvaluator', () => {
  let evaluator: ExpressionEvaluator;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
  });

  describe('evaluate', () => {
    it('should evaluate simple equality expressions', () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: { name: 'cpu_load', value: 0.95 },
      };

      const result = evaluator.evaluate('type=="metric"', context);
      expect(result).toBe(true);
    });

    it('should evaluate complex expressions with AND operator', () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: { name: 'cpu_load', value: 0.95 },
      };

      const result = evaluator.evaluate(
        'type=="metric" && payload.name=="cpu_load" && payload.value>0.9',
        context
      );
      expect(result).toBe(true);
    });

    it('should evaluate expressions with OR operator', () => {
      const context: EvaluationContext = {
        type: 'log',
        payload: { level: 'error' },
      };

      const result = evaluator.evaluate('type=="metric" || payload.level=="error"', context);
      expect(result).toBe(true);
    });

    it('should handle numeric comparisons', () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: { value: 75 },
      };

      expect(evaluator.evaluate('payload.value > 50', context)).toBe(true);
      expect(evaluator.evaluate('payload.value < 100', context)).toBe(true);
      expect(evaluator.evaluate('payload.value >= 75', context)).toBe(true);
      expect(evaluator.evaluate('payload.value <= 75', context)).toBe(true);
      expect(evaluator.evaluate('payload.value == 75', context)).toBe(true);
    });

    it('should handle attributes in context', () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: {},
        attributes: { severity: 'critical' },
      };

      const result = evaluator.evaluate('attributes.severity=="critical"', context);
      expect(result).toBe(true);
    });

    it('should throw error on invalid expression', () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: {},
      };

      expect(() => {
        evaluator.evaluate('invalid..expression', context);
      }).toThrow();
    });

    it('should handle missing properties gracefully', () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: {},
      };

      // Should not throw, but return false for undefined comparisons
      const result = evaluator.evaluate('payload.nonexistent=="value"', context);
      expect(result).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate correct expressions', () => {
      expect(evaluator.validate('type=="metric"')).toBe(true);
      expect(evaluator.validate('payload.value > 0.9')).toBe(true);
      expect(evaluator.validate('type=="log" && payload.level=="error"')).toBe(true);
    });

    it('should reject invalid expressions', () => {
      expect(evaluator.validate('invalid..expression')).toBe(false);
      expect(evaluator.validate('=====')).toBe(false);
    });
  });

  describe('getVariables', () => {
    it('should extract variables from expression', () => {
      const vars = evaluator.getVariables('type=="metric" && payload.value>0.9');
      expect(vars).toContain('type');
      expect(vars).toContain('payload');
    });

    it('should return empty array for invalid expression', () => {
      const vars = evaluator.getVariables('invalid..expression');
      expect(vars).toEqual([]);
    });
  });
});
