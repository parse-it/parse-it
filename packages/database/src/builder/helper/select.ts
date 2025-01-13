import { SelectNode } from "../../types"

/**
 *
 * @param args
 * @returns
 */
export function select(
  ...args: (string | SelectNode | { name: string; alias: string })[]
): SelectNode[] {
  return args.map((arg) => {
    if (isSelectNode(arg)) return arg
    const val = typeof arg === "string" ? arg : arg.name
    const alias = typeof arg === "string" ? undefined : arg.alias
    return {
      type: "select",
      expression: { type: "expression", left: val },
      alias,
    }
  })
}

export function isSelectNode(arg: any): arg is SelectNode {
  return arg.type === "select"
}
