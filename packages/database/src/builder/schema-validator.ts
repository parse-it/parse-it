// import { QueryNode, Schema, Table, ValidationRule } from "../query.model";
// import { checkIsFromTable } from "../string-query-builder";
import {
  ExpressionNode,
  QueryNode,
  SelectNode,
  SubQueryNode,
  TableNode,
} from "../types";
import { Schema, ValidationRule } from "./mode";
import { checkIsFromTable } from "./util";
import { ValidationError } from "./validation.error";

export class SchemaValidator implements ValidationRule {
  validate(query: QueryNode, schema?: Schema): ValidationError[] {
    if (!schema || !checkIsFromTable(query.from)) return [];
    const tableSchema = schema[query.from.name];

    // Validate table existence
    if (!tableSchema) {
      return [
        new ValidationError(
          `Table '${query.from.name}' does not exist in the schema.`,
          "FROM",
          "Ensure the table exists in the database."
        ),
      ];
    }

    return [
      ...validateColumnExistenceInSchema(query as QueryNode, tableSchema),
      ...validateColumnExistenceInWhere(query as QueryNode, tableSchema),
    ];
  }
}

function validateColumnExistenceInSchema(
  query: QueryNode,
  columns: Schema[string]
): ValidationError[] {
  const errors: ValidationError[] = [];

  function validateSelectNode(
    select: SelectNode,
    from: TableNode | SubQueryNode
  ): void {
    if (select.expression.type === "expression") {
      if (
        typeof select.expression.left === "string" &&
        !columns.includes(select.expression.left)
      ) {
        if (!checkIsFromTable(from)) return;
        errors.push(
          new ValidationError(
            `Column '${select.expression.left}' does not exist in table '${from.name}'.`,
            "SELECT",
            "Check the column name or the table schema."
          )
        );
      }
    }
  }

  query.selects.forEach((select) => {
    if (query.from.type === "table") {
      validateSelectNode(select, query.from);
    } else if (query.from.type === "subquery") {
      validateColumnExistenceInSchema(query.from.query, columns);
    }
  });

  return errors;
}

function validateColumnExistenceInWhere(
  query: QueryNode,
  columns: Schema[string]
): ValidationError[] {
  const errors: ValidationError[] = [];

  function validateExpressionNode(
    expression: ExpressionNode,
    from: TableNode | SubQueryNode
  ): void {
    if (typeof expression.left === "string") {
      if (!columns.includes(expression.left)) {
        if (!checkIsFromTable(from)) return;
        errors.push(
          new ValidationError(
            `Column '${expression.left}' does not exist in table '${from.name}'.`,
            "WHERE",
            "Check the column name or the table schema."
          )
        );
      }
    } else if (typeof expression.left === "object") {
      validateExpressionNode(expression.left, from);
    }

    if (expression.right) {
      if (
        typeof expression.right === "object" &&
        !Array.isArray(expression.right)
      ) {
        validateExpressionNode(expression.right, from);
      }
    }
  }

  if (query.where?.conditions) {
    query.where.conditions.forEach((filter) => {
      if (query.from.type === "table") {
        validateExpressionNode(filter, query.from);
      } else if (query.from.type === "subquery") {
        validateColumnExistenceInWhere(query.from.query, columns);
      }
    });
  }

  return errors;
}
