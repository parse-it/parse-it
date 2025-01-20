import { ExpressionNode } from "../types"
import { valueWrapper } from "./helper"
import { ParameterManager } from "./parameter.manager"

/**
 * Handles the construction and management of SQL expressions.
 * Provides methods to safely build complex SQL expressions while maintaining proper operator precedence.
 *
 * @class ExpressionBuilder
 * @internal
 *
 * @example
 * ```typescript
 * const builder = new ExpressionBuilder(parameterManager);
 * const expr = builder.buildExpression({
 *   left: 'column',
 *   operator: '=',
 *   right: { left: 'value', type: 'expression' }
 * });
 * ```
 */
export class ExpressionBuilder {
  constructor(private paramManager: ParameterManager) {}

  buildExpression(
    expr: ExpressionNode,
    customParamManager?: ParameterManager,
  ): string {
    const currentParamManager = customParamManager || this.paramManager
    if (this.isSimpleLiteral(expr)) {
      return currentParamManager.addParameter(expr.left)
    }

    if (expr.operator && expr.right) {
      return this.buildBinaryExpression(expr)
    }

    if (expr.left === null) {
      return "NULL"
    }

    if (expr.type === "expression") {
      return this.buildExpressionValue(expr)
    }

    if (typeof expr.left === "object" && expr.left.type === "expression") {
      return this.buildExpression(expr.left)
    }

    throw new Error(`Unsupported expression: ${JSON.stringify(expr)}`)
  }

  private isSimpleLiteral(expr: ExpressionNode) {
    return (
      (typeof expr.left === "string" || typeof expr.left === "number") &&
      !expr.operator &&
      !expr.right
    )
  }

  private buildBinaryExpression(expr: ExpressionNode) {
    const leftPart = this.buildExpression(expr.left as ExpressionNode)
    const rightPart = this.buildExpression(expr.right as ExpressionNode)

    return `${leftPart} ${expr.operator} ${rightPart}`
  }

  private buildExpressionValue(expr: ExpressionNode) {
    return Array.isArray(expr.left)
      ? valueWrapper(expr.left) + ""
      : JSON.stringify(expr.left)
  }
}
