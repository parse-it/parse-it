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
} from '../types';
import { LexicalAnalyzer } from './lexical-analyzer';
import { Schema } from './mode';
import { SchemaValidator } from './schema-validator';
import { SyntaxAnalyzer } from './syntax-analyzer';
import { applyMaybeClause, checkIsFromTable } from './util';
import { ValidationPipeline } from './validation-pipeline';

export enum QueryBuilderMode {
  SIMPLE = 'SIMPLE',
  NAMED = 'NAMED',
  POSITIONAL = 'POSITIONAL',
}

export interface QueryBuildResult {
  query: string;
  parameters?: Record<string, any> | any[];
}

export class QueryBuilder {
  private validationPipeline: ValidationPipeline;
  private mode: QueryBuilderMode = QueryBuilderMode.NAMED;

  constructor(mode: QueryBuilderMode = QueryBuilderMode.NAMED) {
    this.validationPipeline = new ValidationPipeline([
      new LexicalAnalyzer(),
      new SyntaxAnalyzer(),
      new SchemaValidator(),
    ]);
    this.mode = mode;
  }

  setMode(mode: QueryBuilderMode) {
    this.mode = mode;
  }

  validate(queryNode: QueryNode, schema?: Schema) {
    const errors = this.validationPipeline.validate(queryNode, schema);
    if (errors.length > 0) {
      throw new Error(
        `Query validation failed:\n${errors
          .map((e) => `- ${e.message} (Location: ${e.location})`)
          .join('\n')}`,
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
        typeof value === 'string' || typeof value === 'number';

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

      return expr.left === null ? 'NULL' : JSON.stringify(expr.left);
    };

    const clauses: Array<{
      value: unknown;
      builder: (value: any) => string;
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
        builder: (v: GroupByNode) => this.buildGroupByClause(v),
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
    ];

    const query = clauses
      .map(({ value, builder }) => applyMaybeClause(value, builder))
      .filter((sql) => sql)
      .join(' ')
      .trim();

    return {
      query,
      parameters:
        this.mode === QueryBuilderMode.SIMPLE ? undefined : parameters,
    };
  }

  private buildWithClause(withNodes: WithNode[]) {
    return `WITH ${withNodes
      .map((node) => `${node.name} AS (${this.build(node.query).query})`)
      .join(', ')}`;
  }

  private buildSelectClause(
    selects: SelectNode[],
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return selects
      .map((select) =>
        select.alias
          ? `${buildExpression(select.expression)} AS ${select.alias}`
          : buildExpression(select.expression),
      )
      .join(', ');
  }

  private buildFromClause(from: TableNode | SubQueryNode) {
    return checkIsFromTable(from)
      ? `FROM ${from.name}${from.alias ? ` AS ${from.alias}` : ''}`
      : `FROM (${this.build(from.query).query})${from.alias ? ` AS ${from.alias}` : ''}`;
  }

  private buildJoinClause(
    joins: JoinNode[],
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return joins
      .map((join) => {
        const table = checkIsFromTable(join.table)
          ? `${join.table.name}${join.table.alias ? ` AS ${join.table.alias}` : ''}`
          : `(${this.build(join.table.query).query})${join.table.alias ? ` AS ${join.table.alias}` : ''}`;
        return `${this.mapJoinType(join.joinType)} ${table} ON ${buildExpression(join.on)}`;
      })
      .join(' ');
  }

  private buildWhereClause(
    where: FilterNode,
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return `WHERE ${buildExpression(where.conditions[0])}`;
  }

  private buildGroupByClause(groupBy: GroupByNode) {
    return `GROUP BY ${groupBy.columns.join(', ')}`;
  }

  private buildHavingClause(
    having: FilterNode,
    buildExpression: (expr: ExpressionNode) => string,
  ) {
    return `HAVING ${buildExpression(having.conditions[0])}`;
  }

  private buildOrderByClause(orderBy: OrderByNode[]) {
    return `ORDER BY ${orderBy.map((o) => `${o.column} ${o.direction}`).join(', ')}`;
  }

  private buildLimitClause(limit: number) {
    return `LIMIT ${limit}`;
  }

  private buildOffsetClause(offset: number) {
    return `OFFSET ${offset}`;
  }

  private mapJoinType(joinType: JoinNode['joinType']) {
    const joinTypes: Record<string, string> = {
      INNER: 'INNER JOIN',
      LEFT: 'LEFT JOIN',
      RIGHT: 'RIGHT JOIN',
      FULL: 'FULL JOIN',
      CROSS: 'CROSS JOIN',
    };
    return joinTypes[joinType] || 'JOIN';
  }
}
