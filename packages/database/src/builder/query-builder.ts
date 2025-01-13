import {
  ExpressionNode,
  FilterNode,
  GroupByNode,
  JoinNode,
  OrderByNode,
  QueryNode,
  SelectNode,
  SubQueryNode,
  TableNode,
  WithNode,
} from "../types"
import { groupBy, select, valueWrapper } from "./helper"
import { LexicalAnalyzer } from "./lexical-analyzer"
import { Schema } from "./mode"
import { SchemaValidator } from "./schema-validator"
import { SyntaxAnalyzer } from "./syntax-analyzer"
import { applyMaybeClause, checkIsFromTable } from "./util"
import { ValidationPipeline } from "./validation-pipeline"

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
 * Interface representing the result of a query build operation.
 */
export interface QueryBuildResult {
  /**
   * The generated SQL query string.
   */
  query: string
  /**
   * The parameters to be used in the query. This can be a record of named parameters or an array of positional parameters.
   */
  parameters?: Record<string, any> | any[]
}

class ParameterManager {
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

class ExpressionBuilder {
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

export class QueryBuilder {
  private readonly validationPipeline: ValidationPipeline
  private mode: QueryBuilderMode

  constructor(mode: QueryBuilderMode = QueryBuilderMode.NAMED) {
    this.validationPipeline = new ValidationPipeline([
      new LexicalAnalyzer(),
      new SyntaxAnalyzer(),
      new SchemaValidator(),
    ])
    this.mode = mode
  }

  setMode(mode: QueryBuilderMode) {
    this.mode = mode
  }

  validate(queryNode: QueryNode, schema?: Schema) {
    const errors = this.validationPipeline.validate(queryNode, schema)
    if (errors.length > 0) {
      throw new Error(
        `Query validation failed:\n${errors
          .map((e) => `- ${e.message} (Location: ${e.location})`)
          .join("\n")}`,
      )
    }
  }

  build(queryNode: QueryNode, schema?: Schema): QueryBuildResult {
    this.validate(queryNode, schema)
    const paramManager = new ParameterManager(this.mode)
    const expressionBuilder = new ExpressionBuilder(paramManager)

    const query = this.buildQuery(queryNode, expressionBuilder)

    return {
      query,
      parameters: paramManager.getParameters(),
    }
  }

  private buildQuery(
    queryNode: QueryNode,
    expressionBuilder: ExpressionBuilder,
  ) {
    const queryParts = this.getQueryParts(queryNode, expressionBuilder)
    return queryParts
      .map(({ value, builder }) => applyMaybeClause(value, builder))
      .filter(Boolean)
      .join(" ")
      .trim()
  }

  private getQueryParts(
    queryNode: QueryNode,
    expressionBuilder: ExpressionBuilder,
  ): Array<{
    value: unknown
    builder: (value: any) => string
  }> {
    return [
      {
        value: queryNode.with,
        builder: (v: WithNode[]) => this.buildWithClause(v),
      },
      {
        value: null,
        builder: () =>
          `SELECT ${this.buildSelectClause(
            queryNode.selects,
            expressionBuilder.buildExpression.bind(expressionBuilder),
          )}`,
      },
      {
        value: null,
        builder: () => this.buildFromClause(queryNode.from),
      },
      {
        value: queryNode.joins,
        builder: (v: JoinNode[]) =>
          this.buildJoinClause(
            v,
            expressionBuilder.buildExpression.bind(expressionBuilder),
          ),
      },
      {
        value: queryNode.where,
        builder: (v: FilterNode) => this.buildWhereClause(v, expressionBuilder),
      },
      {
        value: queryNode.groupBy,
        builder: (v: GroupByNode | string | string[]) =>
          this.buildGroupByClause(v),
      },
      {
        value: queryNode.having,
        builder: (v: FilterNode) =>
          this.buildHavingClause(
            v,
            expressionBuilder.buildExpression.bind(expressionBuilder),
          ),
      },
      {
        value: queryNode.orderBy,
        builder: (v: OrderByNode[]) => this.buildOrderByClause(v),
      },
      {
        value: queryNode.limit,
        builder: (v: number) => this.buildLimitClause(v),
      },
      {
        value: queryNode.offset,
        builder: (v: number) => this.buildOffsetClause(v),
      },
    ]
  }

  private buildWithClause(withNodes: WithNode[]) {
    return `WITH ${withNodes
      .map((node) => `${node.name} AS (${this.build(node.query).query})`)
      .join(", ")}`
  }

  private buildSelectClause(
    selects: SelectNode[] | string[],
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    const normalizedSelects = selects.map((s) =>
      typeof s === "string" ? select(s)[0] : s,
    )
    return normalizedSelects
      .map((select) =>
        select.alias
          ? `${buildExpression(select.expression)} AS ${select.alias}`
          : buildExpression(select.expression),
      )
      .join(", ")
  }

  private buildFromClause(fromNode: TableNode | SubQueryNode | string) {
    const from =
      typeof fromNode === "string"
        ? ({ type: "table", name: fromNode } as TableNode)
        : fromNode

    return checkIsFromTable(from)
      ? `FROM ${from.name}${from.alias ? ` AS ${from.alias}` : ""}`
      : `FROM (${this.build(from.query).query})${
          from.alias ? ` AS ${from.alias}` : ""
        }`
  }

  private buildJoinClause(
    joins: JoinNode[],
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return joins
      .map((join) => {
        const table = this.buildJoinTable(join.table)
        return `${this.mapJoinType(join.joinType)} ${table} ON ${buildExpression(
          join.on,
        )}`
      })
      .join(" ")
  }

  private buildJoinTable(table: TableNode | SubQueryNode) {
    return checkIsFromTable(table)
      ? `${table.name}${table.alias ? ` AS ${table.alias}` : ""}`
      : `(${this.build(table.query).query})${
          table.alias ? ` AS ${table.alias}` : ""
        }`
  }

  private buildWhereClause(
    where: FilterNode,
    expressionBuilder: ExpressionBuilder,
  ) {
    if (!where.conditions || where.conditions.length === 0) {
      return ""
    }

    const whereClause = where.conditions
      .map((condition) => expressionBuilder.buildExpression(condition))
      .join(` ${where.operator} `)

    return `WHERE ${whereClause}`
  }

  private buildGroupByClause(_groupBy: GroupByNode | string | string[]) {
    const normalizedGroupBy = groupBy(_groupBy)
    return `GROUP BY ${normalizedGroupBy.columns.join(", ")}`
  }

  private buildHavingClause(
    having: FilterNode,
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return `HAVING ${buildExpression(having.conditions[0])}`
  }

  private buildOrderByClause(orderBy: OrderByNode[]) {
    return `ORDER BY ${orderBy
      .map((o) => `${o.column} ${o.direction}`)
      .join(", ")}`
  }

  private buildLimitClause(limit: number) {
    return `LIMIT ${limit}`
  }

  private buildOffsetClause(offset: number) {
    return `OFFSET ${offset}`
  }

  private mapJoinType(joinType: JoinNode["joinType"]) {
    const joinTypes: Record<string, string> = {
      INNER: "INNER JOIN",
      LEFT: "LEFT JOIN",
      RIGHT: "RIGHT JOIN",
      FULL: "FULL JOIN",
      CROSS: "CROSS JOIN",
    }
    return joinTypes[joinType] || "JOIN"
  }
}
