import { QueryNode } from "../types";
import { ValidationRule } from "./mode";
import { traverseExpression } from "./util";
import { ValidationError } from "./validation.error";

export class LexicalAnalyzer implements ValidationRule {
  /**
   * List of valid SQL operators. Focusing on the most common operators.
   * @link https://cloud.google.com/bigquery/docs/reference/standard-sql/operators
   */
  private validOperators = [
    "=",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "<>",
    "IS",
    "IS NOT",
    "IN",
    "NOT IN",
    "BETWEEN",
    "NOT BETWEEN",
    "LIKE",
    "NOT LIKE",
    "AND",
    "OR",
    "NOT",
    "+",
    "-",
    "*",
    "/",
    "UNION ALL",
    "UNION DISTINCT",
    "EXCEPT DISTINCT",
    "EXCEPT ALL",
    "INTERSECT DISTINCT",
    "INTERSECT ALL",
    "||",
    "~",
    "&",
    "|",
    "^",
  ];

  /**
   * List of reserved SQL keywords that cannot be used as column names.
   * @link https://cloud.google.com/bigquery/docs/reference/standard-sql/lexical#reserved_keywords
   */
  private reservedKeywords = [
    "ALL",
    "AND",
    "ANY",
    "ARRAY",
    "AS",
    "ASC",
    "ASSERT_ROWS_MODIFIED",
    "AT",
    "BETWEEN",
    "BY",
    "CASE",
    "CAST",
    "COLLATE",
    "CONTAINS",
    "CREATE",
    "CROSS",
    "CUBE",
    "CURRENT",
    "DEFAULT",
    "DEFINE",
    "DESC",
    "DISTINCT",
    "ELSE",
    "END",
    "ENUM",
    "ESCAPE",
    "EXCEPT",
    "EXCLUDE",
    "EXISTS",
    "EXTRACT",
    "FALSE",
    "FETCH",
    "FOLLOWING",
    "FOR",
    "FROM",
    "FULL",
    "GROUP",
    "GROUPING",
    "GROUPS",
    "HASH",
    "HAVING",
    "IF",
    "IGNORE",
    "IN",
    "INNER",
    "INTERSECT",
    "INTERVAL",
    "INTO",
    "IS",
    "JOIN",
    "LATERAL",
    "LEFT",
    "LIKE",
    "LIMIT",
    "LOOKUP",
    "MERGE",
    "NATURAL",
    "NEW",
    "NO",
    "NOT",
    "NULL",
    "NULLS",
    "OF",
    "ON",
    "OR",
    "ORDER",
    "OUTER",
    "OVER",
    "PARTITION",
    "PRECEDING",
    "PROTO",
    "QUALIFY",
    "RANGE",
    "RECURSIVE",
    "RESPECT",
    "RIGHT",
    "ROLLUP",
    "ROWS",
    "SELECT",
    "SET",
    "SOME",
    "STRUCT",
    "TABLESAMPLE",
    "THEN",
    "TO",
    "TREAT",
    "TRUE",
    "UNBOUNDED",
    "UNION",
    "UNNEST",
    "USING",
    "WHEN",
    "WHERE",
    "WINDOW",
    "WITH",
    "WITHIN",
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
    if(select.expression == null) return
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
    if(condition === null) return
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
