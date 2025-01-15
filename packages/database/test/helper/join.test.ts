import { describe, expect, it } from "vitest"
import {
  crossJoin,
  fullJoin,
  innerJoin,
  join,
  joinWhere,
  leftJoin,
  rightJoin,
} from "../../src"

describe("join", () => {
  it("should create a basic JOIN clause", () => {
    const result = join("table1", "table1.id", "=", "table2.id")
    expect(result).toEqual({
      type: "join",
      joinType: "JOIN",
      table: { type: "table", name: "table1" },
      on: {
        type: "expression",
        left: { type: "expression", left: "table1.id" },
        operator: "=",
        right: { type: "expression", left: "table2.id" },
      },
    })
  })

  it("should create a LEFT JOIN clause", () => {
    const result = leftJoin("table1", "table1.id", "=", "table2.id")
    expect(result).toMatchObject({ joinType: "LEFT" })
  })

  it("should create a RIGHT JOIN clause", () => {
    const result = rightJoin("table1", "table1.id", "=", "table2.id")
    expect(result).toMatchObject({ joinType: "RIGHT" })
  })

  it("should create a FULL JOIN clause", () => {
    const result = fullJoin("table1", "table1.id", "=", "table2.id")
    expect(result).toMatchObject({ joinType: "FULL" })
  })

  it("should create a CROSS JOIN clause", () => {
    const result = crossJoin("table1", "table1.id", "=", "table2.id")
    expect(result).toMatchObject({ joinType: "CROSS" })
  })

  it("should create an INNER JOIN clause", () => {
    const result = innerJoin("table1", "table1.id", "=", "table2.id")
    expect(result).toMatchObject({ joinType: "INNER" })
  })

  it("should create a JOIN with WHERE clause", () => {
    const result = joinWhere("table1", "table1.id", "=", "table2.id", "LEFT")
    expect(result).toMatchObject({ joinType: "LEFT" })
  })
})
