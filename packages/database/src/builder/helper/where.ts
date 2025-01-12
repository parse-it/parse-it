import { ExpressionNode, FilterNode } from "../../types"

/**
 * Wraps a value in quotes if it is a string or an array.
 * @param value - Value to wrap.
 * @returns Wrapped value.
 */
function valueWrapper(
  value: string | number | string[] | number[],
): string | number {
  if (Array.isArray(value)) {
    return `(${value.map(valueWrapper).join(",")})`
  }
  if (typeof value === "string") {
    return `'${value}'`
  }

  return value
}
/**
 * Constructs a nested `ExpressionNode` from an array of conditions.
 * @param conditions - Array of conditions with column, operator, and value.
 * @param booleanOperator - Boolean operator to use between conditions ("AND" or "OR").
 * @returns A nested `ExpressionNode`.
 */
function conditions(
  conditions: {
    column: string
    operator: string
    value: string | number | string[] | number[]
  }[],
  booleanOperator: string = "AND",
): ExpressionNode {
  if (conditions.length === 1) {
    const { column, operator, value } = conditions[0]
    console.log(conditions[0])
    return {
      type: "expression",
      left: { type: "expression", left: column },
      operator,
      right: { type: "expression", left: valueWrapper(value) },
    }
  }

  // Reduce the array of conditions into a single nested `ExpressionNode`.
  return conditions.slice(1).reduce<ExpressionNode>(
    (acc, condition) => {
      const { column, operator, value } = condition
      const newCondition: ExpressionNode = {
        type: "expression",
        left: { type: "expression", left: column },
        operator,
        right: {
          type: "expression",
          left: valueWrapper(value),
        },
      }

      return {
        type: "expression",
        left: acc,
        operator: booleanOperator,
        right: newCondition,
      }
    },
    {
      type: "expression",
      left: { type: "expression", left: conditions[0].column },
      operator: conditions[0].operator,
      right: {
        type: "expression",
        left: valueWrapper(conditions[0].value),
      },
    },
  )
}

/**
 * Constructs a `FilterNode` for the `WHERE` clause from an array of `ExpressionNode`s.
 * @param conditions - Array of `ExpressionNode`s representing the WHERE conditions.
 * @param operator - Boolean operator to use between the top-level conditions ("AND" or "OR").
 * @returns A `FilterNode`.
 */
function where(
  conditions: ExpressionNode[] | ExpressionNode,
  operator: "AND" | "OR" = "AND",
): FilterNode {
  return {
    type: "filter",
    operator,
    conditions: Array.isArray(conditions) ? conditions : [conditions],
  }
}

export { conditions, where }
