import { describe, expect, it } from "vitest"
import { from, groupBy, orderBy } from "../../src"
import { GroupByNode, TableNode } from "../../src/types"

describe("from", () => {
  it("should create a TableNode from a string", () => {
    const result = from("table1")
    expect(result).toEqual({ type: "table", name: "table1" })
  })

  it("should return a TableNode object unchanged", () => {
    const tableNode: TableNode = { type: "table", name: "table1" }
    const result = from(tableNode)
    expect(result).toEqual(tableNode)
  })
})

describe("groupBy", () => {
  it("should create a GroupByNode from a single string", () => {
    const result = groupBy("column1")
    expect(result).toEqual({ type: "groupby", columns: ["column1"] })
  })

  it("should create a GroupByNode from an array of strings", () => {
    const result = groupBy(["column1", "column2"])
    expect(result).toEqual({ type: "groupby", columns: ["column1", "column2"] })
  })

  it("should return a GroupByNode object unchanged", () => {
    const groupByNode: GroupByNode = { type: "groupby", columns: ["column1"] }
    const result = groupBy(groupByNode)
    expect(result).toEqual(groupByNode)
  })
})

describe("orderBy", () => {
  it("should create an OrderByNode with default DESC direction", () => {
    const result = orderBy("column1")
    expect(result).toEqual({
      type: "orderby",
      column: "column1",
      direction: "DESC",
    })
  })

  it("should create an OrderByNode with specified ASC direction", () => {
    const result = orderBy("column1", "ASC")
    expect(result).toEqual({
      type: "orderby",
      column: "column1",
      direction: "ASC",
    })
  })
})
