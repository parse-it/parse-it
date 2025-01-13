import {
  ExpressionNode,
  FilterNode,
  GroupByNode,
  JoinNode,
  OrderByNode,
  QueryNode,
  SelectNode,
  TableNode,
  WithNode,
} from "../types"
import { expressionHandlers } from "./expression.handler"

export class ASTMapper {
  map(parsedAST: any): QueryNode {
    const { ast } = parsedAST
    // Handle array-based AST
    if (Array.isArray(ast)) {
      const [mainQuery] = ast // Assuming the main query is the first element
      return this.map({ ast: mainQuery })
    }

    if (!ast || ast.type !== "select") {
      throw new Error("Invalid AST: Root node must be a SELECT query.")
    }

    const withNodes = ast.with ? this.mapWithClauses(ast.with) : []

    const result: QueryNode = {
      type: "query",
      with: withNodes,
      selects: this.mapSelects(ast.columns),
      from: this.mapFrom(ast.from),
      joins: this.mapJoins(ast.from),
      where: ast.where ? this.mapFilter(ast.where) : undefined,
      groupBy: ast.groupby ? this.mapGroupBy(ast.groupby) : undefined,
      having: ast.having ? this.mapFilter(ast.having) : undefined,
      orderBy: ast.orderby ? this.mapOrderBy(ast.orderby) : [],
      limit: ast.limit?.value?.[0]?.value,
      offset: ast.limit?.value?.[1]?.value,
      unions: [], // Extend later if UNION is supported
    }

    return JSON.parse(JSON.stringify(result))
  }

  private mapWithClauses(withClauses: any[]): WithNode[] {
    return withClauses.map((cte) => ({
      type: "with",
      name: cte.name.value,
      query: this.map(cte.stmt), // Recursively map the nested query
    }))
  }

  private mapSelects(columns: any[] | undefined): SelectNode[] {
    if (!Array.isArray(columns)) {
      throw new Error("Invalid AST structure: 'columns' must be an array.")
    }

    return columns.map((column) => ({
      type: "select",
      expression: this.mapExpression(column.expr),
      alias: column.as || undefined,
    }))
  }

  private mapFrom(from: any[]): TableNode {
    const mainTable = from[0]
    return {
      type: "table",
      name: mainTable.table,
      alias: mainTable.as || undefined,
    }
  }

  private mapJoins(from: any[]): JoinNode[] {
    return from.slice(1).map((join) => ({
      type: "join",
      joinType: join.join.replace(" JOIN", "").toUpperCase(),
      table: {
        type: "table",
        name: join.table,
        alias: join.as || undefined,
      },
      on: this.mapExpression(join.on),
    }))
  }

  private mapFilter(filter: any): FilterNode {
    return {
      type: "filter",
      operator: "AND",
      conditions: [this.mapExpression(filter)],
    }
  }

  private mapGroupBy(groupby: any): GroupByNode {
    return {
      type: "groupby",
      columns: groupby.columns.map((col: any) => this.mapExpression(col).left),
    }
  }

  private mapOrderBy(orderby: any[]): OrderByNode[] {
    return orderby.map((order) => ({
      type: "orderby",
      column: this.mapExpression(order.expr).left as string,
      direction: order.type.toUpperCase(),
    }))
  }

  private mapExpression(expr: any): ExpressionNode {
    if (!expr || typeof expr !== "object" || !expr.type) {
      throw new Error(`Invalid expression: ${JSON.stringify(expr)}`)
    }

    switch (expr.type) {
      case "column_ref":
        return {
          type: "expression",
          left: expr.table ? `${expr.table}.${expr.column}` : expr.column,
        }

      case "binary_expr":
        return {
          type: "expression",
          left: this.mapExpression(expr.left),
          operator: expr.operator,
          right: this.mapExpression(expr.right),
        }

      case "function":
        const functionName =
          Array.isArray(expr.name?.name) && expr.name?.length > 0
            ? expr.name.name.map((n: any) => n.value).join(".")
            : expr.name?.value || expr.name?.schema?.value || "UNKNOWN_FUNCTION"

        const functionArgs =
          expr.args?.type === "expr_list" && Array.isArray(expr.args.value)
            ? expr.args.value
                .map((arg: any) => this.mapExpression(arg).left)
                .join(", ")
            : ""

        return {
          type: "expression",
          left: `${functionName}(${functionArgs})`,
        }

      case "case":
        const caseParts = expr.args
          .map((arg: any) => {
            if (arg.type === "when") {
              const condition = this.mapExpression(arg.cond)
              const result = this.mapExpression(arg.result).left
              if (
                typeof condition.left === "object" &&
                typeof condition.right === "object" &&
                !Array.isArray(condition.right)
              ) {
                return `WHEN ${condition.left.left} ${condition.operator} ${condition.right.left} THEN ${result}`
              }
              return `WHEN ${condition.left} ${condition.operator} ${condition.right} THEN ${result}`
            }
            if (arg.type === "else") {
              const elseResult = this.mapExpression(arg.result).left
              return `ELSE ${elseResult}`
            }
            return null
          })
          .filter(Boolean)
          .join(" ")

        return {
          type: "expression",
          left: `CASE ${caseParts} END`,
        }

      case "star":
        return {
          type: "expression",
          left: "*", // Represents the `*` in SQL
        }

      case "interval":
        return {
          type: "expression",
          left: `INTERVAL ${this.mapExpression(expr.expr).left} ${expr.unit}`,
        }

      case "is_expr":
        return {
          type: "expression",
          left: this.mapExpression(expr.left).left,
          operator: expr.operator, // Typically "IS" or "IS NOT"
          right: expr.right ? this.mapExpression(expr.right).left : undefined,
        }

      case "aggr_func": // Handles SUM, AVG, etc.
        const aggrFunctionName = expr.name

        // Handle the case where args can be a single "star" or a list of expressions
        const aggrFunctionArgs =
          expr.args?.expr?.type === "star"
            ? "*" // Directly handle the "star" type
            : expr.args?.expr // If "expr" exists and is not "star", map it recursively
              ? this.mapExpression(expr.args.expr).left
              : ""

        return {
          type: "expression",
          left: `${aggrFunctionName}(${aggrFunctionArgs})`,
        }
      case "expr_list":
        return {
          type: "expression",
          left: `(${expr.value.map((arg: any) => this.mapExpression(arg).left).join(", ")})`,
        }

      case "single_quote_string":
        return {
          type: "expression",
          left: `'${expr.value}'`,
        }
      case "null":
      case "number":
      case "string":
        return {
          type: "expression",
          left: expr.value,
        }

      default:
        throw new Error(`Unsupported expression type: ${JSON.stringify(expr)}`)
    }
  }

  private mapExpressionFunctional(expr: any): ExpressionNode {
    if (!expr || typeof expr !== "object" || !expr.type) {
      throw new Error(`Invalid expression: ${JSON.stringify(expr)}`)
    }
    // Find the appropriate handler for the expression type
    const handler = expressionHandlers[expr.type]
    if (!handler) {
      throw new Error(`Unsupported expression type: ${JSON.stringify(expr)}`)
    }

    return handler(expr, this.mapExpressionFunctional)
  }
  private mapWindowSpec(windowSpec: any): string {
    const partitionBy = windowSpec.partition_clause
      ? `PARTITION BY ${windowSpec.partition_clause
          .map((col: any) => this.mapExpression(col).left)
          .join(", ")}`
      : ""
    const orderBy = windowSpec.order_by_clause
      ? `ORDER BY ${windowSpec.order_by_clause
          .map((col: any) => this.mapExpression(col.expr).left + " " + col.type)
          .join(", ")}`
      : ""
    return `${partitionBy} ${orderBy}`.trim()
  }
}
