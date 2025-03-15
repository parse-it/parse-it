import { ExpressionNode, FilterNode } from "../../types"

/**
 * Wraps a value in quotes if it is a string or an array.
 * @param value - Value to wrap.
 * @returns Wrapped value.
 */
export function valueWrapper(
  value:
    | string
    | number
    | null
    | boolean
    | (string | number | boolean | null)[],
): string | number | null | boolean {
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
    value: string | number | string[] | number[] | null | boolean
  }[],
  booleanOperator: string = "AND",
): ExpressionNode {
  if (conditions.length === 1) {
    const { column, operator, value } = conditions[0]
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
 * Conditions that are array with empty right values are removed from the list.
 * @param conditions
 * @returns
 */
export function validConditions(conditions: ExpressionNode[]) {
  return conditions.filter((condition) =>
    typeof condition.right == "object" && condition.right.type == "expression"
      ? condition.right.left != "()"
      : true,
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
  conditions = Array.isArray(conditions) ? conditions : [conditions]

  return {
    type: "filter",
    operator,
    conditions: validConditions(conditions),
  }
}

/**
 * Updates a condition in a filter node or adds a new condition if no match is found.
 *
 * @param {FilterNode} filter - The filter object containing a list of conditions.
 * @param {ExpressionNode} newCondition - The new condition to add or update in the filter.
 * @param {"AND" | "OR"} [operator="AND"] - The operator to use when adding the new condition.
 * @returns {FilterNode} - The updated filter node with the condition updated or added.
 *
 * @example
 * Input Filter:
 * {
 *   operator: "AND",
 *   conditions: [
 *     {
 *       type: "expression",
 *       left: { type: "expression", left: "age" },
 *       operator: ">",
 *       right: { type: "expression", left: 18 }
 *     },
 *     {
 *       type: "expression",
 *       left: { type: "expression", left: "name" },
 *       operator: "LIKE",
 *       right: { type: "expression", left: "'John%'" }
 *     }
 *   ]
 * }
 *
 * New Condition:
 * {
 *   type: "expression",
 *   left: { type: "expression", left: "age" },
 *   operator: ">=",
 *   right: { type: "expression", left: 21 }
 * }
 *
 * Process:
 * 1. Check if the `newCondition` matches any existing conditions in `filter.conditions`.
 * 2. If a match is found:
 *    - Update the matched condition.
 * 3. If no match is found:
 *    - Add the `newCondition` to the list of conditions with the specified operator.
 *
 * Updated Filter (Match Found):
 * {
 *   operator: "AND",
 *   conditions: [
 *     {
 *       type: "expression",
 *       left: { type: "expression", left: "age" },
 *       operator: ">=",
 *       right: { type: "expression", left: 21 }
 *     },
 *     {
 *       type: "expression",
 *       left: { type: "expression", left: "name" },
 *       operator: "LIKE",
 *       right: { type: "expression", left: "'John%'" }
 *     }
 *   ]
 * }
 *
 * Updated Filter (No Match Found):
 * {
 *   operator: "AND",
 *   conditions: [
 *     {
 *       type: "expression",
 *       left: { type: "expression", left: "age" },
 *       operator: ">",
 *       right: { type: "expression", left: 18 }
 *     },
 *     {
 *       type: "expression",
 *       left: { type: "expression", left: "name" },
 *       operator: "LIKE",
 *       right: { type: "expression", left: "'John%'" }
 *     },
 *     {
 *       type: "expression",
 *       left: { type: "expression", left: "age" },
 *       operator: ">=",
 *       right: { type: "expression", left: 21 }
 *     }
 *   ]
 * }
 */
export function updateOrAddCondition(
  filter: FilterNode,
  newCondition: ExpressionNode,
  operator: "AND" | "OR" = "AND",
): FilterNode {
  let updated = false

  const updatedConditions = filter.conditions.map((condition) => {
    if (condition.type === "filter") {
      const updatedFilter = updateOrAddCondition(
        condition,
        newCondition,
        operator,
      )
      if (updatedFilter !== condition) {
        updated = true
      }
      return updatedFilter
    } else if (condition.type === "expression") {
      const result = updateCondition(condition, newCondition)
      if (result) {
        updated = true
        return result
      }
    }
    return condition
  })

  if (updated) {
    return { ...filter, conditions: updatedConditions }
  }

  return {
    ...filter,
    conditions: [...filter.conditions, newCondition],
  }
}

/**
 * Updates an expression tree by replacing the parent node if a match is found for the `left` property in the `newCondition`.
 * If no match is found, the function returns `null`.
 *
 * @param {ExpressionNode} node - The root node of the expression tree to be updated.
 * @param {ExpressionNode} newCondition - The new condition to replace the matched node in the tree.
 * @returns {ExpressionNode | null} - The updated tree if a match is found; otherwise, `null`.
 *
 * @example
 * Input SQL = "SELECT * FROM users WHERE age > 18 AND name LIKE 'John%'"
 * New Condition SQL = "SELECT * FROM users WHERE age > 21 AND name LIKE 'John%'"
 * Input Tree:
 *                  AND
 *                /     \
 *              >         LIKE
 *            /   \      /    \
 *         age     18  name   'John%'
 *
 * New Condition:
 *                  >
 *                /   \
 *             age    21
 *
 * Output Tree (Match Found):
 *                  AND
 *                /     \
 *              >         LIKE
 *            /   \      /    \
 *         age     21  name   'John%'
 *
 * If no match is found, the function returns `null`.
 */
export function updateCondition(
  node: ExpressionNode,
  newCondition: ExpressionNode,
): ExpressionNode | null {
  let matchFound = false

  function traverseAndUpdate(node: ExpressionNode): ExpressionNode {
    if (
      node.type === "expression" &&
      node.left &&
      typeof node.left === "object" &&
      node.left.type === "expression" &&
      typeof newCondition.left === "object" &&
      newCondition.left &&
      newCondition.left.type === "expression" &&
      isConditionEqual(node.left, newCondition.left)
    ) {
      matchFound = true
      return newCondition
    }
    const updatedLeft =
      typeof node.left === "object" &&
      node.left &&
      node.left.type === "expression"
        ? traverseAndUpdate(node.left)
        : node.left

    const updatedRight =
      typeof node.right === "object" && node.right.type === "expression"
        ? traverseAndUpdate(node.right)
        : node.right
    return {
      ...node,
      left: updatedLeft,
      right: updatedRight,
    }
  }
  const updatedNode = traverseAndUpdate(node)
  return matchFound ? updatedNode : null
}

export function isConditionEqual(
  cond1: ExpressionNode,
  cond2: ExpressionNode,
): boolean {
  return (
    cond1.type === cond2.type &&
    cond1.operator === cond2.operator &&
    JSON.stringify(cond1.left) === JSON.stringify(cond2.left) &&
    JSON.stringify(cond1.right) === JSON.stringify(cond2.right)
  )
}
