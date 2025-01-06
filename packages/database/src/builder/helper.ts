import {
  FilterNode,
  GroupByNode,
  JOIN_TYPE,
  JoinNode,
  OrderByNode,
  SelectNode,
  TableNode,
} from "../types"

/**
 *
 * @param args
 * @returns
 */
export function select(...args: string[]): SelectNode[] {
  return args.map((arg) => {
    return { type: "select", expression: { type: "expression", left: arg } }
  })
}

export type JoinHelperArgs = [
  table: string | Pick<TableNode, "name" | "alias">,
  first: string,
  operator: string | null,
  second: string,
  joinType?: JOIN_TYPE,
  where?: boolean,
]

/**
 * Constructs a JoinNode representing a SQL JOIN clause with the given arguments.
 * 
 * @param args - An array containing the table, first column, operator, second column, and optional join type.
 *   - table: The table to join, either as a string or an object with table details.
 *   - first: The first column in the join condition.
 *   - operator: The operator for the join condition (defaults to "=" if not provided).
 *   - second: The second column in the join condition.
 *   - joinType: The type of join (e.g., "INNER JOIN", "LEFT JOIN"). Defaults to "JOIN" if not provided.
 * @returns A JoinNode representing the JOIN clause.
 */
export function join(...args: JoinHelperArgs): JoinNode {
  const [table, first, operator, second, joinType] = args
  const formattedTable: TableNode =
    typeof table === "string"
      ? { type: "table", name: table }
      : { type: "table", ...table }
  return {
    type: "join",
    joinType: joinType || "JOIN",
    table: formattedTable,
    on: {
      type: "expression",
      left: { type: "expression", left: first },
      operator: operator || "=",
      right: { type: "expression", left: second },
    },
  }
}

/**
 *
 * @param JoinHelperArgs
 * @returns
 */
export function leftJoin(...args: JoinHelperArgs): JoinNode {
  const [table, first, operator, second] = args
  return join(table, first, operator, second, "LEFT")
}

/**
 *
 * @param JoinHelperArgs
 * @returns
 */
export function rightJoin(...args: JoinHelperArgs): JoinNode {
  const [table, first, operator, second] = args
  return join(table, first, operator, second, "RIGHT")
}

/**
 *
 * @param JoinHelperArgs
 * @returns
 */
export function fullJoin(...args: JoinHelperArgs): JoinNode {
  const [table, first, operator, second] = args
  return join(table, first, operator, second, "FULL")
}

/**
 *
 * @param JoinHelperArgs
 * @returns
 */
export function crossJoin(...args: JoinHelperArgs): JoinNode {
  const [table, first, operator, second] = args
  return join(table, first, operator, second, "CROSS")
}

/**
 *
 * @param JoinHelperArgs
 * @returns
 */
export function innerJoin(...args: JoinHelperArgs): JoinNode {
  const [table, first, operator, second] = args
  return join(table, first, operator, second, "INNER")
}

/**
 *
 * @param JoinHelperArgs
 * @returns
 */
export function joinWhere(...args: JoinHelperArgs): JoinNode {
  const [table, first, operator, second, joinType] = args
  return join(table, first, operator, second, joinType, true)
}

/**
 * Constructs a FilterNode representing a WHERE clause with the given conditions and boolean operator.
 * 
 * @param conditions - An array of condition objects, each containing a column, operator, and value.
 * @param booleanOperator - The boolean operator to combine the conditions, either "AND" or "OR". Defaults to "AND".
 * @returns A FilterNode representing the WHERE clause.
 */
export function where(
  conditions: { column: string; operator: string; value: string | number }[],
  booleanOperator: "AND" | "OR" = "AND",
): FilterNode {
  return {
    type: "filter",
    operator: booleanOperator,
    conditions: conditions.map((condition) => {
      return {
        type: "expression",
        left: { type: "expression", left: condition.column },
        operator: condition.operator,
        right: { type: "expression", left: condition.value },
      }
    }),
  }
}

/**
 *
 * @param columns
 * @returns
 */
export function groupBy(...columns: string[]): GroupByNode {
  return { type: "groupby", columns }
}

/**
 *
 * @param column
 * @param direction
 * @returns
 */
export function orderBy(
  column: string,
  direction: "ASC" | "DESC" = "DESC",
): OrderByNode {
  return { type: "orderby", column, direction }
}
