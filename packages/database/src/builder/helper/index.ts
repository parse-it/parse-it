import { GroupByNode, OrderByNode, SubQueryNode, TableNode } from "../../types"

export * from "./join"
export * from "./select"
export * from "./where"

/**
 *
 * @param fromNode
 * @returns
 */
export function from(fromNode: string | TableNode | SubQueryNode | string) {
  return typeof fromNode === "string"
    ? ({ type: "table", name: fromNode } as TableNode)
    : fromNode
}
/**
 *
 * @param columns
 * @returns
 */
export function groupBy(columns: string[] | string | GroupByNode): GroupByNode {
  if (typeof columns === "string")
    return { type: "groupby", columns: [columns] }
  if (Array.isArray(columns)) return { type: "groupby", columns }
  return columns
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
