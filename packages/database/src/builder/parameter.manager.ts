/**
 * Enum representing the different modes of the QueryBuilder for BigQuery.
 *
 * - SIMPLE: This mode is used for basic query building without any parameterization.
 *   Example Output: `SELECT * FROM users WHERE age > 30`
 *   Note: if you get part of the query from user input, you should use a different mode to prevent SQL injection.
 *
 * - NAMED: This mode allows for named parameters in the query, which can be replaced with actual values at runtime.
 *   Example Output: `SELECT * FROM users WHERE age > @age`
 *
 * - POSITIONAL: This mode uses positional parameters in the query, which are replaced with actual values based on their position.
 *   Example Output: `SELECT * FROM users WHERE age > ?`
 */
export enum QueryBuilderMode {
  SIMPLE = "SIMPLE",
  NAMED = "NAMED",
  POSITIONAL = "POSITIONAL",
}

/**
 * Manages query parameters across different modes (Simple, Named, Positional).
 * Handles the generation and storage of query parameters in a type-safe manner.
 *
 * @class ParameterManager
 * @internal
 *
 * @example
 * ```typescript
 * const manager = new ParameterManager(QueryBuilderMode.NAMED);
 * const param = manager.addParameter('value'); // Returns "@param1"
 * const parameters = manager.getParameters(); // Returns { param1: 'value' }
 * ```
 */
export class ParameterManager {
  private parameters: Record<string, any> | any[]
  private paramIndex: number
  private readonly mode: QueryBuilderMode

  constructor(mode: QueryBuilderMode) {
    this.mode = mode
    this.parameters = mode === QueryBuilderMode.NAMED ? {} : []
    this.paramIndex = 1
  }

  addParameter(value: any): string {
    if (this.mode === QueryBuilderMode.SIMPLE) {
      return `${value}`
    }

    if (this.mode === QueryBuilderMode.NAMED) {
      const paramName = `param${this.paramIndex++}`
      ;(this.parameters as Record<string, any>)[paramName] = value
      return `@${paramName}`
    }

    ;(this.parameters as any[]).push(value)
    this.paramIndex++
    return "?"
  }

  addParameters(values: any[]): string[] {
    return values.map((value) => this.addParameter(value))
  }

  getParameters() {
    return this.mode === QueryBuilderMode.SIMPLE ? undefined : this.parameters
  }
}
