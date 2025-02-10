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
 * Represents the result of a query building operation.
 *
 * @interface QueryBuildResult
 * @property {string} query - The generated SQL query string
 * @property {Record<string, any> | any[] | undefined} parameters - Query parameters (if any)
 *
 * @example
 * ```typescript
 * const result: QueryBuildResult = {
 *   query: "SELECT * FROM users WHERE id = @param1",
 *   parameters: { param1: 123 }
 * };
 * ```
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

/**
 * A powerful and flexible SQL query builder with support for parameterized queries and schema validation.
 *
 * @class QueryBuilder
 * @exports
 *
 * @example
 * Basic Usage:
 * ```typescript
 * const builder = new QueryBuilder(QueryBuilderMode.NAMED);
 * const result = builder.build({
 *   selects: ['column1', 'column2'],
 *   from: 'table_name',
 *   where: {
 *     conditions: [{ left: 'column1', operator: '=', right: { left: 'value', type: 'expression' } }],
 *     operator: 'AND'
 *   }
 * });
 * // result.query = "SELECT column1, column2 FROM table_name WHERE column1 = @param1"
 * // result.parameters = { param1: 'value' }
 * ```
 *
 * Complex Query:
 * ```typescript
 * const result = builder.build({
 *   with: [{
 *     name: 'cte',
 *     query: {
 *       selects: ['col1', 'col2'],
 *       from: 'source_table'
 *     }
 *   }],
 *   selects: ['t.col1', 't.col2'],
 *   from: 'cte t',
 *   joins: [{
 *     joinType: 'LEFT',
 *     table: { type: 'table', name: 'other_table', alias: 'o' },
 *     on: { left: 't.id', operator: '=', right: { left: 'o.id', type: 'expression' } }
 *   }],
 *   groupBy: ['t.col1'],
 *   having: {
 *     conditions: [{ left: 'COUNT(*)', operator: '>', right: { left: 5, type: 'expression' } }],
 *     operator: 'AND'
 *   }
 * });
 * ```
 *
 * @param {QueryBuilderMode} [mode=QueryBuilderMode.NAMED] - The parameter mode to use for query building
 *
 * @throws {Error} Will throw an error if query validation fails
 *
 * @see {@link QueryBuilderMode} for available parameter modes
 * @see {@link QueryBuildResult} for the structure of the build result
 */
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
    selects: (SelectNode | string)[],
    buildExpression: (
      expr: ExpressionNode,
      customParamManager?: ParameterManager,
    ) => string,
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

  /**
   * Generates a SQL `WHERE` clause from a structured `FilterNode`.
   *
   * Recursively processes the `FilterNode` and its conditions to produce a
   * SQL-compliant `WHERE` clause. Ensures logical grouping with parentheses
   * only where necessary.
   *
   * @param {FilterNode} where - The root filter node containing the query conditions.
   * @param {ExpressionBuilder} expressionBuilder - Utility to convert `ExpressionNode` to SQL.
   * @returns {string}
   *
   * @example
   * const filterNode = {
   *   type: "filter",
   *   operator: "AND",
   *   conditions: [
   *     { type: "expression", operator: ">", left: { type: "expression", left: "age" }, right: { type: "expression", left: 18 } },
   *     { type: "filter", operator: "OR", conditions: [
   *       { type: "expression", operator: "=", left: { type: "expression", left: "name" }, right: { type: "expression", left: "'John'" } },
   *       { type: "expression", operator: "<", left: { type: "expression", left: "age" }, right: { type: "expression", left: 18 } }
   *     ]}
   *   ]
   * };
   *
   * buildWhereClause(filterNode, expressionBuilder);
   * // WHERE age > 18 AND (name = 'John' OR age < 18)
   */
  private buildWhereClause(
    where: FilterNode,
    expressionBuilder: ExpressionBuilder,
  ) {
    if (!where.conditions || where.conditions.length === 0) {
      return ""
    }

    const buildCondition = (
      condition: ExpressionNode | FilterNode,
      parentOperator?: string,
    ): string => {
      if (condition.type === "filter") {
        const nestedConditions = condition.conditions
          .map((nestedCondition) =>
            buildCondition(nestedCondition, condition.operator),
          )
          .join(` ${condition.operator} `)

        // Add parentheses only if the nested operator differs from the parent operator
        if (parentOperator && parentOperator !== condition.operator) {
          return `(${nestedConditions})`
        }

        return nestedConditions
      } else {
        return expressionBuilder.buildExpression(condition as ExpressionNode)
      }
    }

    const whereClause = where.conditions
      .map((condition) => buildCondition(condition, where.operator))
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
  ): string {
    if (!having.conditions || having.conditions.length === 0) {
      return ""
    }

    const buildCondition = (condition: ExpressionNode | FilterNode): string => {
      if (condition.type === "filter") {
        const nestedConditions = condition.conditions
          .map((nestedCondition) => buildCondition(nestedCondition))
          .join(` ${condition.operator} `)

        return `(${nestedConditions})`
      } else {
        return buildExpression(condition as ExpressionNode)
      }
    }

    const havingClause = having.conditions
      .map((condition) => buildCondition(condition))
      .join(` ${having.operator} `)

    return `HAVING ${havingClause}`
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
