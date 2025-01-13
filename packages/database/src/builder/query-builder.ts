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
import { ExpressionBuilder } from "./expression-builder"
import { groupBy, select } from "./helper"
import { Schema } from "./mode"
import { ParameterManager, QueryBuilderMode } from "./parameter.manager"
import { applyMaybeClause, checkIsFromTable } from "./util"
import { LexicalAnalyzer } from "./validation/lexical-analyzer"
import { SchemaValidator } from "./validation/schema-validator"
import { SyntaxAnalyzer } from "./validation/syntax-analyzer"
import { ValidationPipeline } from "./validation/validation-pipeline"

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
