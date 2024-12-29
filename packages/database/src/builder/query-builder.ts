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
} from "../types";
import { LexicalAnalyzer } from "./lexical-analyzer";
import { Schema } from "./mode";
import { SchemaValidator } from "./schema-validator";
import { SyntaxAnalyzer } from "./syntax-analyzer";
import { checkIsFromTable } from "./util";
import { ValidationPipeline } from "./validation-pipeline";

export enum QueryBuilderMode {
  SIMPLE = "SIMPLE",
  NAMED = "NAMED",
  POSITIONAL = "POSITIONAL",
}

export interface QueryBuildResult {
  query: string;
  parameters?: Record<string, any> | any[];
}

export class QueryBuilder {
  private validationPipeline: ValidationPipeline;
  private mode: QueryBuilderMode = QueryBuilderMode.SIMPLE;

  constructor(mode: QueryBuilderMode = QueryBuilderMode.SIMPLE) {
    this.validationPipeline = new ValidationPipeline([
      new LexicalAnalyzer(),
      new SyntaxAnalyzer(),
      new SchemaValidator(),
    ]);
    this.mode = mode;
  }

  setMode(mode: QueryBuilderMode): void {
    this.mode = mode;
  }

  validate(queryNode: QueryNode, schema?: Schema): void {
    const errors = this.validationPipeline.validate(queryNode, schema);
    if (errors.length > 0) {
      throw new Error(
        `Query validation failed:\n${errors
          .map((e) => `- ${e.message} (Location: ${e.location})`)
          .join("\n")}`
      );
    }
  }

  build(queryNode: QueryNode, schema?: Schema): QueryBuildResult {
    this.validate(queryNode, schema);

    const parameters: any[] | Record<string, any> =
      this.mode === QueryBuilderMode.NAMED ? {} : [];
    let paramIndex = 1; // For positional parameters

    const buildExpression = (expr: ExpressionNode): string => {
      const isLiteral = (value: any) =>
        typeof value === "string" || typeof value === "number";

      if (isLiteral(expr.left) && !expr.operator && !expr.right) {
        if (this.mode === QueryBuilderMode.NAMED) {
          const paramName = `param${paramIndex}`;
          paramIndex++;
          (parameters as Record<string, any>)[paramName] = expr.left;
          return `@${paramName}`;
        } else if (this.mode === QueryBuilderMode.POSITIONAL) {
          (parameters as any[]).push(expr.left);
          return `?`;
        }
        return `${expr.left}`;
      }

      if (expr.operator && expr.right) {
        return `${buildExpression(expr.left as ExpressionNode)} ${
          expr.operator
        } ${buildExpression(expr.right as ExpressionNode)}`;
      }

      return expr.left === null ? "NULL" : JSON.stringify(expr.left);
    };

    const clauses = [
      () => this.buildWithClause(queryNode.with),
      () =>
        `SELECT ${this.buildSelectClause(queryNode.selects, buildExpression)}`,
      () => this.buildFromClause(queryNode.from, buildExpression),
      () => this.buildJoinClause(queryNode.joins, buildExpression),
      () => this.buildWhereClause(queryNode.where, buildExpression),
      () => this.buildGroupByClause(queryNode.groupBy),
      () => this.buildHavingClause(queryNode.having, buildExpression),
      () => this.buildOrderByClause(queryNode.orderBy),
      () => this.buildLimitClause(queryNode.limit),
      () => this.buildOffsetClause(queryNode.offset),
    ];

    const query = clauses
      .map((clause) => clause())
      .filter((sql) => sql)
      .join(" ")
      .trim();

    return {
      query,
      parameters:
        this.mode === QueryBuilderMode.SIMPLE ? undefined : parameters,
    };
  }

  private buildWithClause(withNodes?: WithNode[]): string {
    return withNodes?.length
      ? `WITH ${withNodes
          .map((node) => `${node.name} AS (${this.build(node.query).query})`)
          .join(", ")}`
      : "";
  }

  private buildSelectClause(
    selects: SelectNode[],
    buildExpression: (expr: ExpressionNode) => string
  ): string {
    return selects
      .map((select) =>
        select.alias
          ? `${buildExpression(select.expression)} AS ${select.alias}`
          : buildExpression(select.expression)
      )
      .join(", ");
  }

  private buildFromClause(
    from: TableNode | SubQueryNode | undefined,
    buildExpression: (expr: ExpressionNode) => string
  ): string {
    if (!from) return "";
    return checkIsFromTable(from)
      ? `FROM ${from.name}${from.alias ? ` AS ${from.alias}` : ""}`
      : `FROM (${this.build(from.query).query})${from.alias ? ` AS ${from.alias}` : ""}`;
  }

  private buildJoinClause(
    joins: JoinNode[] | undefined,
    buildExpression: (expr: ExpressionNode) => string
  ): string {
    if (!joins?.length) return "";
    return joins
      .map((join) => {
        const table = checkIsFromTable(join.table)
          ? `${join.table.name}${join.table.alias ? ` AS ${join.table.alias}` : ""}`
          : `(${this.build(join.table.query).query})${join.table.alias ? ` AS ${join.table.alias}` : ""}`;
        return `${this.mapJoinType(join.joinType)} ${table} ON ${buildExpression(join.on)}`;
      })
      .join(" ");
  }

  private buildWhereClause(
    where: FilterNode | undefined,
    buildExpression: (expr: ExpressionNode) => string
  ): string {
    return where ? `WHERE ${buildExpression(where.conditions[0])}` : "";
  }

  private buildGroupByClause(groupBy?: GroupByNode): string {
    return groupBy ? `GROUP BY ${groupBy.columns.join(", ")}` : "";
  }

  private buildHavingClause(
    having: FilterNode | undefined,
    buildExpression: (expr: ExpressionNode) => string
  ): string {
    return having ? `HAVING ${buildExpression(having.conditions[0])}` : "";
  }

  private buildOrderByClause(orderBy?: OrderByNode[]): string {
    return orderBy?.length
      ? `ORDER BY ${orderBy.map((o) => `${o.column} ${o.direction}`).join(", ")}`
      : "";
  }

  private buildLimitClause(limit?: number): string {
    return limit !== undefined ? `LIMIT ${limit}` : "";
  }

  private buildOffsetClause(offset?: number): string {
    return offset !== undefined ? `OFFSET ${offset}` : "";
  }

  private mapJoinType(joinType: JoinNode["joinType"]): string {
    const joinTypes: Record<string, string> = {
      INNER: "INNER JOIN",
      LEFT: "LEFT JOIN",
      RIGHT: "RIGHT JOIN",
      FULL: "FULL JOIN",
      CROSS: "CROSS JOIN",
    };
    return joinTypes[joinType] || "JOIN";
  }
}
