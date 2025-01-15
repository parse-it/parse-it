import { describe, expect, it } from "vitest"
import { isSelectNode, select } from "../../src"
import { SelectNode } from "../../src/types"

describe("select", () => {
  it("should create SelectNode from string arguments", () => {
    const result = select("column1", "column2")
    expect(result).toEqual([
      {
        type: "select",
        expression: { type: "expression", left: "column1" },
        alias: undefined,
      },
      {
        type: "select",
        expression: { type: "expression", left: "column2" },
        alias: undefined,
      },
    ])
  })

  it("should create SelectNode with alias from object arguments", () => {
    const result = select({ name: "column1", alias: "col1" })
    expect(result).toEqual([
      {
        type: "select",
        expression: { type: "expression", left: "column1" },
        alias: "col1",
      },
    ])
  })

  it("should return existing SelectNode objects unchanged", () => {
    const existingNode: SelectNode = {
      type: "select",
      expression: { type: "expression", left: "column1" },
      alias: "col1",
    }
    const result = select(existingNode)
    expect(result).toEqual([existingNode])
  })

  it("should identify a valid SelectNode using isSelectNode", () => {
    const validNode: SelectNode = {
      type: "select",
      expression: { type: "expression", left: "column1" },
      alias: "col1",
    }
    expect(isSelectNode(validNode)).toBe(true)
  })

  it("should reject invalid SelectNode using isSelectNode", () => {
    const invalidNode = { type: "expression", left: "column1" }
    expect(isSelectNode(invalidNode)).toBe(false)
  })
})
