import { QueryBuilder, QueryBuilderMode } from "../builder"
import {
  ExpressionNode,
  FilterNode,
  GroupByNode,
  JOIN_TYPE,
  JoinNode,
  OrderByNode,
  QueryNode,
  SelectNode,
  SubQueryNode,
  TableNode,
  WithNode,
} from "../types"
import { expressionHandlers } from "./expression.handler"
import * as Parser from "../grammar/bigquery.pegjs"

type TableColumnAst = Parser.TableColumnAst
type AST = Parser.AST
type Select = Parser.Select
type Join = Parser.Join
type BaseFrom = Parser.BaseFrom

export class ASTMapper {
  isAST(parsedAST: TableColumnAst | AST | AST[]): parsedAST is AST | AST[] {
    return (
      Array.isArray(parsedAST) ||
      !(parsedAST as TableColumnAst).tableList !== undefined
    )
  }

  isTableColumnAst(
    parsedAST: TableColumnAst | AST,
  ): parsedAST is TableColumnAst {
    return (parsedAST as TableColumnAst).tableList !== undefined
  }

  map(parsedAST: TableColumnAst | AST): QueryNode {
    if (this.isAST(parsedAST) && Array.isArray(parsedAST)) {
      const [mainQuery] = parsedAST as AST[] // Assuming the main query is the first element
      return this.map({ ast: mainQuery } as TableColumnAst)
    }
    let ast = this.isTableColumnAst(parsedAST) ? parsedAST.ast : parsedAST

    if (!ast) {
      throw new Error("Invalid AST: Root node must be a SELECT query.")
    }
    ast = Array.isArray(ast) ? ast[0] : ast

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

  private mapWithClauses(withClauses: Select["with"]): WithNode[] {
    if (!Array.isArray(withClauses)) {
      return []
    }
    return withClauses.map((cte) => ({
      type: "with",
      name: cte.name.value,
      query: this.map(cte.stmt), // Recursively map the nested query
    }))
  }

  private mapSelects(columns: Select["columns"]): SelectNode[] {
    if (!Array.isArray(columns)) {
      console.log(columns, "c")
      throw new Error("Invalid AST structure: 'columns' must be an array.")
    }

    return columns.map((column) => ({
      type: "select",
      expression: this.mapExpression(column.expr),
      alias: column.as || undefined,
    }))
  }

  private mapFrom(from: Select["from"]): TableNode | SubQueryNode {
    if (from === null || from === undefined) {
      throw new Error("Invalid AST structure: 'from' must be an array.")
    }

    if (!Array.isArray(from)) {
      return {
        type: "subquery",
        query: this.map(from.expr.ast),
        alias: from.as || undefined,
      }
    }
    const mainTable = from.find((v) => Object.hasOwn(v, "table")) as
      | BaseFrom
      | undefined
    if (!mainTable) {
      throw new Error(
        "Invalid AST structure: 'from' must contain a main table.",
      )
    }
    return {
      type: "table",
      name: mainTable.table,
      alias: mainTable.as || undefined,
    }
  }

  private mapJoins(from: Select["from"]): JoinNode[] {
    if (from === null || !Array.isArray(from)) return []

    const isJoin = (v: any): v is Join => Object.hasOwn(v, "join")

    return from
      .filter((v) => isJoin(v))
      .map(
        (join) =>
          ({
            type: "join",
            joinType: join.join as JOIN_TYPE,
            table: {
              type: "table",
              name: join.table,
              alias: join.as || undefined,
            },
            on: this.mapExpression(join.on),
          }) as JoinNode,
      )
  }

  /**
   * Converts a filter AST into a structured `FilterNode`. The top-level node is always
   * a `FilterNode` where logical conditions are grouped accurately.
   *
   * - Logical expressions (`AND`, `OR`) with `"parentheses": true` are grouped into a new `FilterNode`.
   * - Logical expressions without `"parentheses": true` are flattened into the parent `FilterNode`.
   * - Binary expressions (`>`, `<`, `=`, etc.) are mapped to `ExpressionNode` with `operator`, `left`, and `right`.
   *
   * ### Example Input SQL:
   *
   * ```sql
   * SELECT name, email FROM users WHERE age > 18 AND name = 'John' OR (age < 18 AND name = 'Doe' OR (age = 18 AND name = 'Smith'))
   * ```
   * The AST will be:
   *
   * ```json
   * OR(
   *   AND(age > 18, name = 'John'),
   *   OR(
   *     AND(age < 18, name = 'Doe'),
   *     AND(age = 18, name = 'Smith')  // with parentheses
   *   )  // with parentheses
   * )
   * ```
   *
   * Output `FilterNode`:
   * ```typescript
   * {
   *   type: "filter",
   *   operator: "AND",
   *   conditions: [
   *      ... more conditions ...
   *     { type: "expression", operator: ">", left: { type: "expression", left: "age" }, right: { type: "expression", left: 18 } },
   *     { type: "filter", operator: "OR", conditions: [
   *       { type: "expression", operator: "=", left: { type: "expression", left: "name" }, right: { type: "expression", left: "'John'" } },
   *       { type: "expression", operator: "<", left: { type: "expression", left: "age" }, right: { type: "expression", left: 18 } }
   *     ]}
   *   ]
   * }
   * ```
   *
   * Output SQL representation:
   * ```sql
   * WHERE (age > 18 AND name = 'John') OR ((age < 18 AND name = 'Doe') OR (age = 18 AND name = 'Smith'))
   * ```
   *
   * @param filter - The input AST representing the filter conditions.
   * @returns
   */
  private mapFilter(filter: any): FilterNode {
    if (!filter || typeof filter !== "object" || !filter.type) {
      throw new Error(`Invalid filter node: ${JSON.stringify(filter)}`)
    }

    return this.processNode(filter)
  }

  private processNode(node: any): FilterNode {
    if (node.type !== "binary_expr") {
      return {
        type: "filter",
        operator: "AND",
        conditions: [this.mapExpression(node)],
      }
    }
    if (!["AND", "OR"].includes(node.operator)) {
      // For comparison operators (>, <, =, etc.)
      return {
        type: "filter",
        operator: "AND",
        conditions: [this.mapExpression(node)],
      }
    }

    if (node.parentheses) {
      return {
        type: "filter",
        operator: node.operator,
        conditions: [
          ...this.buildConditions(node.left),
          ...this.buildConditions(node.right),
        ],
      }
    }

    const leftConditions =
      node.left.operator === node.operator && !node.left.parentheses
        ? this.buildConditions(node.left)
        : [this.processNode(node.left)]

    const rightConditions =
      node.right.operator === node.operator && !node.right.parentheses
        ? this.buildConditions(node.right)
        : [this.processNode(node.right)]

    return {
      type: "filter",
      operator: node.operator,
      conditions: [...leftConditions, ...rightConditions],
    }
  }

  private buildConditions(node: any): (ExpressionNode | FilterNode)[] {
    if (!node) return []

    if (node.type !== "binary_expr") {
      return [this.mapExpression(node)]
    }

    if (node.operator === "AND" || node.operator === "OR") {
      return [this.processNode(node)]
    }

    return [this.mapExpression(node)]
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
    if (!expr || typeof expr !== "object") {
      throw new Error(`Invalid expression: ${JSON.stringify(expr)}`)
    }

    if (expr.ast) {
      const queryNode = this.map(expr) // Recursively map the nested query AST
      return {
        type: "expression",
        left: queryNode,
      }
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

        // Handle arguments including nested subqueries
        const functionArgs =
          expr.args?.type === "expr_list" && Array.isArray(expr.args.value)
            ? expr.args.value
                .map((arg: any) => {
                  if (arg.ast) {
                    const queryNode = this.map(arg.ast) // Map the nested subquery AST
                    const queryBuilder = new QueryBuilder(
                      QueryBuilderMode.SIMPLE,
                    )
                    const queryObject = queryBuilder.build(queryNode)
                    return `(${queryObject.query})`
                  } else if (typeof arg === "object") {
                    return this.mapExpression(arg).left
                  } else {
                    // Fallback for non-object arguments (unlikely case)
                    return String(arg)
                  }
                })
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
                condition.left.type != "query" &&
                condition.right.type != "query" &&
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
