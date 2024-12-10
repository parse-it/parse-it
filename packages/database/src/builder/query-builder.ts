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

  validate(queryNode: QueryNode, schema?: Schema) {
    const errors = this.validationPipeline.validate(queryNode, schema);

    if (errors.length > 0) {
      throw new Error(
        "Query validation failed:\n" +
          errors
            .map((e) => `- ${e.message} (Location: ${e.location})`)
            .join("\n")
      );
    }
  }

  build(queryNode: QueryNode, schema?: Schema): string {
    this.validate(queryNode, schema);
    let sql = "";

    if (queryNode.with && queryNode.with.length > 0) {
      sql += this.buildWithClause(queryNode.with) + " ";
    }

    sql += "SELECT " + this.buildSelectClause(queryNode.selects);

    if (queryNode.from) {
      sql += " " + this.buildFromClause(queryNode.from);
    }

    if (queryNode.joins && queryNode.joins.length > 0) {
      sql += " " + this.buildJoinClause(queryNode.joins);
    }

    if (queryNode.where) {
      sql += " " + this.buildWhereClause(queryNode.where);
    }

    if (queryNode.groupBy) {
      sql += " " + this.buildGroupByClause(queryNode.groupBy);
    }

    if (queryNode.having) {
      sql += " " + this.buildHavingClause(queryNode.having);
    }

    if (queryNode.orderBy && queryNode.orderBy.length > 0) {
      sql += " " + this.buildOrderByClause(queryNode.orderBy);
    }

    if (queryNode.limit !== undefined) {
      sql += ` LIMIT ${queryNode.limit}`;
    }
    if (queryNode.offset !== undefined) {
      sql += ` OFFSET ${queryNode.offset}`;
    }

    return sql.trim();
  }

  private buildWithClause(withNodes: WithNode[]): string {
    return (
      "WITH " +
      withNodes
        .map(
          (withNode) => `${withNode.name} AS (${this.build(withNode.query)})`
        )
        .join(", ")
    );
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

  private buildFromClause(from: TableNode | SubQueryNode): string {
    if (checkIsFromTable(from))
      return `FROM ${from.name}${from.alias ? ` AS ${from.alias}` : ""}`;

    return `FROM (${this.build(from.query)})${
      from.alias ? ` AS ${from.alias}` : ""
    }`;
  }

  private buildJoinClause(joins: JoinNode[]): string {
    const joinTypeToExpression = (joinType: JoinNode["joinType"]) => {
      switch (joinType) {
        case "INNER":
          return "INNER JOIN";
        case "LEFT":
          return "LEFT JOIN";
        case "RIGHT":
          return "RIGHT JOIN";
        case "FULL":
          return "FULL JOIN";
        case "CROSS":
          return "CROSS JOIN";
        default:
          return "JOIN";
      }
    };
    return joins
      .map((join) => {
        if (checkIsFromTable(join.table)) {
          return `${joinTypeToExpression(join.joinType)} ${join.table.name}${
            join.table.alias ? ` AS ${join.table.alias}` : ""
          } ON ${this.buildExpression(join.on)}`;
        }
        return `${joinTypeToExpression(join.joinType)} (${this.build(join.table.query)})${
          join.table.alias ? ` AS ${join.table.alias}` : ""
        } ON ${this.buildExpression(join.on)}`;
      })
      .join(" ");
  }

  private buildWhereClause(where: FilterNode): string {
    return `WHERE ${this.buildExpression(where.conditions[0])}`;
  }

  private buildGroupByClause(groupBy: GroupByNode): string {
    return `GROUP BY ${groupBy.columns.join(", ")}`;
  }

  private buildHavingClause(having: FilterNode): string {
    return `HAVING ${this.buildExpression(having.conditions[0])}`;
  }

  private buildQualifyClause(qualify: FilterNode): string {
    return `QUALIFY ${this.buildExpression(qualify.conditions[0])}`;
  }

  private buildOrderByClause(orderBy: OrderByNode[]): string {
    return (
      "ORDER BY " +
      orderBy.map((order) => `${order.column} ${order.direction}`).join(", ")
    );
  }

  private buildExpression(expr: ExpressionNode): string {
    if (typeof expr.left === "string" && !expr.operator && !expr.right) {
      return expr.left;
    }

    if (typeof expr.left === "number" && !expr.operator && !expr.right) {
      return (expr.left as number).toString();
    }

    if (expr.operator && expr.right) {
      return `${this.buildExpression(expr.left as ExpressionNode)} ${
        expr.operator
      } ${this.buildExpression(expr.right as ExpressionNode)}`;
    }

    if (expr.left && !expr.operator && !expr.right) {
      // Fallback for literals or unsupported values
      return typeof expr.left === "string" || typeof expr.left === "number"
        ? `${expr.left}`
        : JSON.stringify(expr.left);
    }
    if (expr.left === null) {
      // Fallback for literals or unsupported values
      return `NULL`;
    }
    throw new Error(`Unsupported expression: ${JSON.stringify(expr)}`);
  }
}
