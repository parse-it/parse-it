import { ExpressionNode } from "../types"
import { valueWrapper } from "./helper"
import { ParameterManager } from "./parameter.manager"

export class ExpressionBuilder {
  constructor(private paramManager: ParameterManager) {}

  buildExpression(expr: ExpressionNode): string {
    if (this.isSimpleLiteral(expr)) {
      return this.paramManager.addParameter(expr.left)
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

    if (this.needsParentheses(expr)) {
      return `(${leftPart} ${expr.operator} ${rightPart})`
    }
    return `${leftPart} ${expr.operator} ${rightPart}`
  }

  private needsParentheses(expr: ExpressionNode): boolean {
    return (
      typeof expr.left === "object" &&
      typeof expr.right === "object" &&
      !Array.isArray(expr.right) &&
      (expr.left.type === "expression" || expr.right.type === "expression") &&
      expr.operator === "OR"
    )
  }

  private buildExpressionValue(expr: ExpressionNode) {
    return Array.isArray(expr.left)
      ? valueWrapper(expr.left) + ""
      : JSON.stringify(expr.left)
  }
}
