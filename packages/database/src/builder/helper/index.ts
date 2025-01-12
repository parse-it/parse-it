import { GroupByNode, OrderByNode } from "../../types"

export * from "./join"
export * from "./select"
export * from "./where"

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
