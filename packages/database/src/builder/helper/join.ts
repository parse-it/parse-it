import { JOIN_TYPE, JoinNode, TableNode } from "../../types"

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
