import { SelectNode } from "../../types"

/**
 *
 * @param args
 * @returns
 */
export function select(
  ...args: (string | { name: string; alias: string })[]
): SelectNode[] {
  return args.map((arg) => {
    const val = typeof arg === "string" ? arg : arg.name
    const alias = typeof arg === "string" ? undefined : arg.alias
    return {
      type: "select",
      expression: { type: "expression", left: val },
      alias,
    }
  })
}
