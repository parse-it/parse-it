import { QueryNode } from "../types";
import { ValidationRule } from "./mode";
import { traverseExpression } from "./util";
import { ValidationError } from "./validation.error";

export class LexicalAnalyzer implements ValidationRule {
  private validOperators = ["=", "!=", ">", ">=", "<", "<=", "IN"];
  private reservedKeywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "GROUP",
    "ORDER",
    "LIMIT",
    "*",
  ];

  validate(query: QueryNode): ValidationError[] {
    return [
      ...validateReservedKeywords(query, this.reservedKeywords),
      ...validateOperators(query, this.validOperators),
    ];
  }
}

function validateReservedKeywords(
  query: QueryNode,
  reservedKeywords: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  query.selects.forEach((select) => {
    traverseExpression(select.expression, (operand) => {
      if (
        typeof operand === "string" &&
        reservedKeywords.includes(operand.toUpperCase())
      ) {
        errors.push(
          new ValidationError(
            `Column name '${operand}' is a reserved SQL keyword.`,
            "SELECT",
            "Rename the column to avoid conflicts."
          )
        );
      }
    });
  });

  return errors;
}

function validateOperators(
  query: QueryNode,
  validOperators: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  (query.where?.conditions || []).forEach((condition) => {
    traverseExpression(condition, (operand, operator) => {
      if (operator && !validOperators.includes(operator)) {
        errors.push(
          new ValidationError(
            `Invalid operator in condition: '${operator}'.`,
            "WHERE",
            `Use one of the valid operators: ${validOperators.join(", ")}.`
          )
        );
      }
    });
  });

  return errors;
}
