import { describe, expect, it } from "vitest"
import {
  conditions,
  isConditionEqual,
  updateCondition,
  updateOrAddCondition,
  valueWrapper,
  where,
} from "../../src"
import { ExpressionNode, FilterNode } from "../../src/types"

describe("valueWrapper", () => {
  it("should wrap string values in quotes", () => {
    expect(valueWrapper("test")).toBe("'test'")
    expect(valueWrapper("hello world")).toBe("'hello world'")
  })

  it("should not wrap number values", () => {
    expect(valueWrapper(42)).toBe(42)
    expect(valueWrapper(0)).toBe(0)
    expect(valueWrapper(-1)).toBe(-1)
  })

  it("should wrap array values in parentheses and quotes if needed", () => {
    expect(valueWrapper(["a", "b"])).toBe("('a','b')")
    expect(valueWrapper([1, 2])).toBe("(1,2)")
    expect(valueWrapper(["test", 123])).toBe("('test',123)")
  })
})

describe("conditions", () => {
  it("should create a simple expression for single condition", () => {
    const result = conditions([{ column: "age", operator: ">", value: 18 }])

    expect(result).toEqual({
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    })
  })

  it("should create nested expressions for multiple conditions with AND", () => {
    const result = conditions(
      [
        { column: "age", operator: ">", value: 18 },
        { column: "name", operator: "LIKE", value: "John%" },
      ],
      "AND",
    )

    expect(result).toEqual({
      type: "expression",
      left: {
        type: "expression",
        left: { type: "expression", left: "age" },
        operator: ">",
        right: { type: "expression", left: 18 },
      },
      operator: "AND",
      right: {
        type: "expression",
        left: { type: "expression", left: "name" },
        operator: "LIKE",
        right: { type: "expression", left: "'John%'" },
      },
    })
  })

  it("should handle array values in conditions", () => {
    const result = conditions([
      { column: "id", operator: "IN", value: [1, 2, 3] },
    ])

    expect(result).toEqual({
      type: "expression",
      left: { type: "expression", left: "id" },
      operator: "IN",
      right: { type: "expression", left: "(1,2,3)" },
    })
  })
})

describe("where", () => {
  it("should create a FilterNode with single condition", () => {
    const expr: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    }

    const result = where(expr)

    expect(result).toEqual({
      type: "filter",
      operator: "AND",
      conditions: [expr],
    })
  })

  it("should create a FilterNode with multiple conditions", () => {
    const expr1: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    }
    const expr2: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "name" },
      operator: "LIKE",
      right: { type: "expression", left: "'John%'" },
    }

    const result = where([expr1, expr2], "OR")

    expect(result).toEqual({
      type: "filter",
      operator: "OR",
      conditions: [expr1, expr2],
    })
  })
})

describe("updateOrAddCondition", () => {
  const baseFilter: FilterNode = {
    type: "filter",
    operator: "AND",
    conditions: [
      {
        type: "expression",
        left: { type: "expression", left: "age" },
        operator: ">",
        right: { type: "expression", left: 18 },
      },
    ],
  }

  it("should add new condition when no match exists", () => {
    const newCondition: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "name" },
      operator: "LIKE",
      right: { type: "expression", left: "'John%'" },
    }

    const result = updateOrAddCondition(baseFilter, newCondition)

    expect(result.conditions).toHaveLength(2)
    expect(result.conditions).toContainEqual(newCondition)
  })

  it("should update existing condition when match found", () => {
    const updatedCondition: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 21 },
    }

    const result = updateOrAddCondition(baseFilter, updatedCondition)
    expect(result.conditions).toHaveLength(1)
    expect(result.conditions[0]).toEqual(updatedCondition)
  })
})

describe("updateCondition", () => {
  it("should update matching condition", () => {
    const original: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    }

    const update: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 21 },
    }

    const result = updateCondition(original, update)
    expect(result).toEqual(update)
  })

  it("should return null when no match found", () => {
    const original: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    }

    const update: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "name" },
      operator: "LIKE",
      right: { type: "expression", left: "'John%'" },
    }

    const result = updateCondition(original, update)
    expect(result).toBeNull()
  })

  it("should handle nested expressions", () => {
    const original: ExpressionNode = {
      type: "expression",
      left: {
        type: "expression",
        left: { type: "expression", left: "age" },
        operator: ">",
        right: { type: "expression", left: 18 },
      },
      operator: "AND",
      right: {
        type: "expression",
        left: { type: "expression", left: "name" },
        operator: "LIKE",
        right: { type: "expression", left: "'John%'" },
      },
    }

    const update: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 21 },
    }

    const result = updateCondition(original, update)
    expect(result?.left).toEqual(update)
  })
})

describe("isConditionEqual", () => {
  it("should return true for identical conditions", () => {
    const cond1: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    }
    const cond2: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    }

    expect(isConditionEqual(cond1, cond2)).toBe(true)
  })

  it("should return false for different conditions", () => {
    const cond1: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">",
      right: { type: "expression", left: 18 },
    }
    const cond2: ExpressionNode = {
      type: "expression",
      left: { type: "expression", left: "age" },
      operator: ">=",
      right: { type: "expression", left: 18 },
    }

    expect(isConditionEqual(cond1, cond2)).toBe(false)
  })

  it("should handle complex nested structures", () => {
    const cond1: ExpressionNode = {
      type: "expression",
      left: {
        type: "expression",
        left: { type: "expression", left: "nested" },
        operator: "=",
        right: { type: "expression", left: "value" },
      },
      operator: "AND",
      right: { type: "expression", left: true },
    }
    const cond2: ExpressionNode = {
      type: "expression",
      left: {
        type: "expression",
        left: { type: "expression", left: "nested" },
        operator: "=",
        right: { type: "expression", left: "value" },
      },
      operator: "AND",
      right: { type: "expression", left: true },
    }

    expect(isConditionEqual(cond1, cond2)).toBe(true)
  })
})
