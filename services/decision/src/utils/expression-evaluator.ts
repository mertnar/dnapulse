import { Parser } from 'expr-eval';
import { EvaluationContext } from '../types/policy';

export class ExpressionEvaluator {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Safely evaluate an expression with a sandboxed context
   * @param expression The expression to evaluate
   * @param context The evaluation context
   * @returns The evaluation result (boolean)
   */
  evaluate(expression: string, context: EvaluationContext): boolean {
    try {
      // Normalize expression: replace && with 'and', || with 'or' for expr-eval compatibility
      const normalizedExpression = expression.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');

      // Create a sandboxed context with only allowed properties
      const sandboxedContext = {
        type: context.type,
        payload: context.payload || {},
        attributes: context.attributes || {},
        ts: context.ts || new Date().toISOString(),
      };

      // Parse and evaluate the expression
      const ast = this.parser.parse(normalizedExpression);
      const result = ast.evaluate(sandboxedContext);

      // Ensure result is boolean
      return Boolean(result);
    } catch (error) {
      console.error(`Expression evaluation error: ${error}`);
      throw new Error(`Invalid expression: ${expression}`);
    }
  }

  /**
   * Validate an expression without evaluating it
   * @param expression The expression to validate
   * @returns true if valid, false otherwise
   */
  validate(expression: string): boolean {
    try {
      const normalizedExpression = expression.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
      this.parser.parse(normalizedExpression);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get variables used in an expression
   * @param expression The expression to analyze
   * @returns Array of variable names
   */
  getVariables(expression: string): string[] {
    try {
      const normalizedExpression = expression.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
      const ast = this.parser.parse(normalizedExpression);
      return ast.variables();
    } catch (error) {
      return [];
    }
  }
}
