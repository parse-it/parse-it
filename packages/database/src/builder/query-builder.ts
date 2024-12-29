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

export class QueryBuilder {
  private validationPipeline: ValidationPipeline;

  constructor() {
    this.validationPipeline = new ValidationPipeline([
      new LexicalAnalyzer(),
      new SyntaxAnalyzer(),
      new SchemaValidator(),
    ]);
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

  build(queryNode: QueryNode, schema?: Schema): string {
    this.validate(queryNode, schema);

    const clauses = [
      () => this.buildWithClause(queryNode.with),
      () => `SELECT ${this.buildSelectClause(queryNode.selects)}`,
      () => this.buildFromClause(queryNode.from),
      () => this.buildJoinClause(queryNode.joins),
      () => this.buildWhereClause(queryNode.where),
      () => this.buildGroupByClause(queryNode.groupBy),
      () => this.buildHavingClause(queryNode.having),
      () => this.buildOrderByClause(queryNode.orderBy),
      () => this.buildLimitClause(queryNode.limit),
      () => this.buildOffsetClause(queryNode.offset),
    ];

    return clauses
      .map((clause) => clause())
      .filter((sql) => sql) // Remove empty clauses
      .join(" ")
      .trim();
  }

  private buildWithClause(withNodes?: WithNode[]): string {
    return withNodes?.length
      ? `WITH ${withNodes
          .map((node) => `${node.name} AS (${this.build(node.query)})`)
          .join(", ")}`
      : "";
  }

  private buildSelectClause(selects: SelectNode[]): string {
    return selects
      .map((select) =>
        select.alias
          ? `${this.buildExpression(select.expression)} AS ${select.alias}`
          : this.buildExpression(select.expression)
      )
      .join(", ");
  }

  private buildFromClause(from?: TableNode | SubQueryNode): string {
    if (!from) return "";
    return checkIsFromTable(from)
      ? `FROM ${from.name}${from.alias ? ` AS ${from.alias}` : ""}`
      : `FROM (${this.build(from.query)})${from.alias ? ` AS ${from.alias}` : ""}`;
  }

  private buildJoinClause(joins?: JoinNode[]): string {
    if (!joins?.length) return "";
    return joins
      .map((join) => {
        const table = checkIsFromTable(join.table)
          ? `${join.table.name}${join.table.alias ? ` AS ${join.table.alias}` : ""}`
          : `(${this.build(join.table.query)})${join.table.alias ? ` AS ${join.table.alias}` : ""}`;
        return `${this.mapJoinType(join.joinType)} ${table} ON ${this.buildExpression(join.on)}`;
      })
      .join(" ");
  }

  private buildWhereClause(where?: FilterNode): string {
    return where ? `WHERE ${this.buildExpression(where.conditions[0])}` : "";
  }

  private buildGroupByClause(groupBy?: GroupByNode): string {
    return groupBy ? `GROUP BY ${groupBy.columns.join(", ")}` : "";
  }

  private buildHavingClause(having?: FilterNode): string {
    return having ? `HAVING ${this.buildExpression(having.conditions[0])}` : "";
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

  private buildExpression(expr: ExpressionNode): string {
    const isLiteral = (value: any) =>
      typeof value === "string" || typeof value === "number";

    if (isLiteral(expr.left) && !expr.operator && !expr.right) {
      return `${expr.left}`;
    }

    if (expr.operator && expr.right) {
      return `${this.buildExpression(expr.left as ExpressionNode)} ${
        expr.operator
      } ${this.buildExpression(expr.right as ExpressionNode)}`;
    }

    return expr.left === null ? "NULL" : JSON.stringify(expr.left);
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