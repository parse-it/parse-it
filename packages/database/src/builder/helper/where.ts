import { ExpressionNode, FilterNode } from "../../types"

/**
 * Wraps a value in quotes if it is a string or an array.
 * @param value - Value to wrap.
 * @returns Wrapped value.
 */
export function valueWrapper(
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
export function conditions(
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
export function where(
  conditions: ExpressionNode[] | ExpressionNode,
  operator: "AND" | "OR" = "AND",
): FilterNode {
  return {
    type: "filter",
    operator,
    conditions: Array.isArray(conditions) ? conditions : [conditions],
  }
}

export function updateOrAddCondition(
  filter: FilterNode,
  newCondition: ExpressionNode,
  operator: "AND" | "OR" = "AND",
): FilterNode {
  let updated = false

  // Recursively update the condition if it exists
  const updatedConditions = filter.conditions.map((condition) => {
    const result = updateCondition(condition, newCondition)
    if (result) {
      updated = true
    }
    return result || condition
  })

  if (updated) {
    return { ...filter, conditions: updatedConditions }
  }

  return {
    ...filter,
    conditions: [...filter.conditions, newCondition],
  }
}

// Helper to recursively update a condition
export function updateCondition(
  node: ExpressionNode,
  newCondition: ExpressionNode,
): ExpressionNode | null {
  if (isConditionEqual(node, newCondition)) {
    return newCondition
  }

  // Check if `left` or `right` are nested ExpressionNodes
  const updatedLeft =
    typeof node.left === "object" && node.left.type === "expression"
      ? updateCondition(node.left, newCondition)
      : node.left

  const updatedRight =
    typeof node.right === "object" &&
    !Array.isArray(node.right) &&
    node.right.type === "expression"
      ? updateCondition(node.right, newCondition)
      : node.right

  if (!updatedLeft && !updatedRight) {
    return null
  }

  return {
    ...node,
    left: updatedLeft || node.left,
    right: updatedRight || node.right,
  }
}

export function isConditionEqual(
  cond1: ExpressionNode,
  cond2: ExpressionNode,
): boolean {
  return (
    JSON.stringify(cond1.left) === JSON.stringify(cond2.left) &&
    cond1.operator === cond2.operator &&
    JSON.stringify(cond1.right) === JSON.stringify(cond2.right)
  )
}
