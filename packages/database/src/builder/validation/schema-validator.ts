import {
  ExpressionNode,
  FilterNode,
  QueryNode,
  SelectNode,
  SubQueryNode,
  TableNode,
} from "../../types"
import { from, select } from "../helper"
import { Schema, ValidationRule } from "../mode"
import { checkIsFromTable } from "../util"
import { ValidationError } from "./validation.error"

export class SchemaValidator implements ValidationRule {
  validate(query: QueryNode, schema?: Schema): ValidationError[] {
    const fromNode = from(query.from)
    if (!schema || !checkIsFromTable(fromNode)) return []
    const tableSchema = schema[fromNode.name]

    // Validate table existence
    if (!tableSchema) {
      return [
        new ValidationError(
          `Table '${fromNode.name}' does not exist in the schema.`,
          "FROM",
          "Ensure the table exists in the database.",
        ),
      ]
    }

    return [
      ...validateColumnExistenceInSchema(query, tableSchema),
      ...validateColumnExistenceInWhere(query, tableSchema),
    ]
  }
}

function validateColumnExistenceInSchema(
  query: QueryNode,
  columns: Schema[string],
): ValidationError[] {
  const fromNode = from(query.from)
  const errors: ValidationError[] = []

  function validateSelectNode(
    select: SelectNode,
    from: TableNode | SubQueryNode,
  ): void {
    if (select.expression.type === "expression") {
      if (
        typeof select.expression.left === "string" &&
        !columns.includes(select.expression.left)
      ) {
        if (!checkIsFromTable(from)) return
        errors.push(
          new ValidationError(
            `Column '${select.expression.left}' does not exist in table '${from.name}'.`,
            "SELECT",
            "Check the column name or the table schema.",
          ),
        )
      }
    }
  }

  query.selects.forEach((selectNode) => {
    if (fromNode.type === "table") {
      validateSelectNode(select(selectNode)[0], fromNode)
    } else if (fromNode.type === "subquery") {
      validateColumnExistenceInSchema(fromNode.query, columns)
    }
  })

  return errors
}

function validateColumnExistenceInWhere(
  query: QueryNode,
  columns: string[],
): ValidationError[] {
  const errors: ValidationError[] = []

  function validateExpressionNode(
    expression: ExpressionNode,
    from: TableNode | SubQueryNode,
  ): void {
    if (typeof expression.left === "string") {
      // Validate column existence in the table or schema
      if (!columns.includes(expression.left)) {
        if (from.type !== "table") return // Skip validation for subqueries
        errors.push(
          new ValidationError(
            `Column '${expression.left}' does not exist in table '${from.name}'.`,
            "WHERE",
            "Check the column name or the table schema.",
          ),
        )
      }
    } else if (
      typeof expression.left === "object" &&
      expression.left.type !== "query"
    ) {
      // Recursively validate nested expressions
      validateExpressionNode(expression.left, from)
    }

    if (expression.right) {
      if (
        typeof expression.right === "object" &&
        expression.right.type !== "query" &&
        !Array.isArray(expression.right)
      ) {
        validateExpressionNode(expression.right, from)
      }
    }
  }

  function validateCondition(
    condition: ExpressionNode | FilterNode,
    from: TableNode | SubQueryNode,
  ): void {
    if (condition.type === "filter") {
      condition.conditions.forEach((nestedCondition) =>
        validateCondition(nestedCondition, from),
      )
    } else if (condition.type === "expression") {
      validateExpressionNode(condition, from)
    }
  }

  const fromNode = from(query.from)
  if (query.where?.conditions) {
    query.where.conditions.forEach((condition) => {
      if (fromNode.type === "table") {
        validateCondition(condition, fromNode)
      } else if (fromNode.type === "subquery") {
        validateColumnExistenceInWhere(fromNode.query, columns)
      }
    })
  }

  return errors
}
