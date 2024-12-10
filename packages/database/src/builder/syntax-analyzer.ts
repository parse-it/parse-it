import { QueryNode } from "../types";
import { ValidationRule } from "./mode";
import { ValidationError } from "./validation.error";

export class SyntaxAnalyzer implements ValidationRule {
  validate(query: QueryNode): ValidationError[] {
    return ([] as any).concat(
      validateGroupByMatchSelect(query),
      validateHavingRequiresGroupBy(query),
      validateLimitWithOrderBy(query)
    );
  }
}

function validateGroupByMatchSelect(query: QueryNode) {
  const errors: ValidationError[] = [];
  const selectColumns = query.selects.map((s) => s.alias || s.expression.left);
  const groupByColumns = query.groupBy?.columns || [];

  groupByColumns.forEach((column) => {
    if (!selectColumns.includes(column)) {
      errors.push(
        new ValidationError(
          `Column '${column}' in GROUP BY must be selected.`,
          "GROUP BY",
          "Add the column to the SELECT clause."
        )
      );
    }
  });
  return errors;
}

function validateHavingRequiresGroupBy(query: QueryNode) {
  const errors: ValidationError[] = [];
  if (query.having && !query.orderBy?.some((s) => s.column === "groupBy")) {
    errors.push(
      new ValidationError(
        "HAVING clause requires a GROUP BY clause.",
        "HAVING",
        "Add a GROUP BY clause to your query."
      )
    );
  }
  return errors;
}

function validateLimitWithOrderBy(query: QueryNode) {
  const errors: ValidationError[] = [];
  if (query?.limit && !query.orderBy) {
    errors.push(
      new ValidationError(
        "LIMIT requires an ORDER BY clause for deterministic results.",
        "LIMIT",
        "Add an ORDER BY clause to your query."
      )
    );
  }
  return errors;
}
