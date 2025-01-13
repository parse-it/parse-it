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
import { select, groupBy } from "./helper"
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

export class QueryBuilder {
  private validationPipeline: ValidationPipeline
  private mode: QueryBuilderMode = QueryBuilderMode.NAMED

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

    const parameters: any[] | Record<string, any> =
      this.mode === QueryBuilderMode.NAMED ? {} : []
    let paramIndex = 1 // For positional parameters

    const buildExpression = (expr: ExpressionNode): string => {
      const isLiteral = (value: any) =>
        typeof value === "string" || typeof value === "number"

      if (isLiteral(expr.left) && !expr.operator && !expr.right) {
        if (this.mode === QueryBuilderMode.NAMED) {
          const paramName = `param${paramIndex}`
          paramIndex++
          ;(parameters as Record<string, any>)[paramName] = expr.left
          return `@${paramName}`
        } else if (this.mode === QueryBuilderMode.POSITIONAL) {
          ;(parameters as any[]).push(expr.left)
          return `?`
        }
        return `${expr.left}`
      }

      if (expr.operator && expr.right) {
        return `${buildExpression(expr.left as ExpressionNode)} ${
          expr.operator
        } ${buildExpression(expr.right as ExpressionNode)}`
      }

      return expr.left === null ? "NULL" : JSON.stringify(expr.left)
    }

    const clauses: Array<{
      value: unknown
      builder: (value: any) => string
    }> = [
      {
        value: queryNode.with,
        builder: (v: WithNode[]) => this.buildWithClause(v),
      },
      {
        value: null,
        builder: () =>
          `SELECT ${this.buildSelectClause(queryNode.selects, buildExpression)}`,
      },
      {
        value: null,
        builder: () => this.buildFromClause(queryNode.from),
      },
      {
        value: queryNode.joins,
        builder: (v: JoinNode[]) => this.buildJoinClause(v, buildExpression),
      },
      {
        value: queryNode.where,
        builder: (v: FilterNode) => this.buildWhereClause(v, buildExpression),
      },
      {
        value: queryNode.groupBy,
        builder: (v: GroupByNode | string | string[]) =>
          this.buildGroupByClause(v),
      },
      {
        value: queryNode.having,
        builder: (v: FilterNode) => this.buildHavingClause(v, buildExpression),
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

    const query = clauses
      .map(({ value, builder }) => applyMaybeClause(value, builder))
      .filter((sql) => sql)
      .join(" ")
      .trim()

    return {
      query,
      parameters:
        this.mode === QueryBuilderMode.SIMPLE ? undefined : parameters,
    }
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
    selects = selects.map((s) => {
      if (typeof s === "string") return select(s)[0]
      return s
    })
    return selects
      .map((select) =>
        select.alias
          ? `${buildExpression(select.expression)} AS ${select.alias}`
          : buildExpression(select.expression),
      )
      .join(", ")
  }

  private buildFromClause(from: TableNode | SubQueryNode | string) {
    const f =
      typeof from === "string"
        ? ({ type: "table", name: from } as TableNode)
        : from
    return checkIsFromTable(f)
      ? `FROM ${f.name}${f.alias ? ` AS ${f.alias}` : ""}`
      : `FROM (${this.build(f.query).query})${f.alias ? ` AS ${f.alias}` : ""}`
  }

  private buildJoinClause(
    joins: JoinNode[],
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return joins
      .map((join) => {
        const table = checkIsFromTable(join.table)
          ? `${join.table.name}${join.table.alias ? ` AS ${join.table.alias}` : ""}`
          : `(${this.build(join.table.query).query})${join.table.alias ? ` AS ${join.table.alias}` : ""}`
        return `${this.mapJoinType(join.joinType)} ${table} ON ${buildExpression(join.on)}`
      })
      .join(" ")
  }

  private buildWhereClause(
    where: FilterNode,
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return `WHERE ${buildExpression(where.conditions[0])}`
  }

  private buildGroupByClause(_groupBy: GroupByNode | string | string[]) {
    _groupBy = groupBy(_groupBy)
    return `GROUP BY ${_groupBy.columns.join(", ")}`
  }

  private buildHavingClause(
    having: FilterNode,
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return `HAVING ${buildExpression(having.conditions[0])}`
  }

  private buildOrderByClause(orderBy: OrderByNode[]) {
    return `ORDER BY ${orderBy.map((o) => `${o.column} ${o.direction}`).join(", ")}`
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
