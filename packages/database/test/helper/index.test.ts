import { describe, expect, it } from "vitest"
import {
  from,
  groupBy,
  innerJoin,
  join,
  joinWhere,
  leftJoin,
  orderBy,
  select,
} from "../../src"

describe("Combined Helpers", () => {
  it("should build a SELECT with JOIN and GROUP BY", () => {
    const selectNodes = select("users.id", "users.name", "orders.total")
    const fromNode = from("users")
    const joinNode = join("orders", "users.id", "=", "orders.user_id")
    const groupByNode = groupBy(["users.id", "users.name"])

    const query = {
      select: selectNodes,
      from: fromNode,
      join: [joinNode],
      groupBy: groupByNode,
    }

    expect(query).toEqual({
      select: [
        {
          type: "select",
          expression: { type: "expression", left: "users.id" },
          alias: undefined,
        },
        {
          type: "select",
          expression: { type: "expression", left: "users.name" },
          alias: undefined,
        },
        {
          type: "select",
          expression: { type: "expression", left: "orders.total" },
          alias: undefined,
        },
      ],
      from: { type: "table", name: "users" },
      join: [
        {
          type: "join",
          joinType: "JOIN",
          table: { type: "table", name: "orders" },
          on: {
            type: "expression",
            left: { type: "expression", left: "users.id" },
            operator: "=",
            right: { type: "expression", left: "orders.user_id" },
          },
        },
      ],
      groupBy: { type: "groupby", columns: ["users.id", "users.name"] },
    })
  })

  it("should build a SELECT with LEFT JOIN and ORDER BY", () => {
    const selectNodes = select(
      "products.id",
      "products.name",
      "categories.name",
    )
    const fromNode = from("products")
    const leftJoinNode = leftJoin(
      "categories",
      "products.category_id",
      "=",
      "categories.id",
    )
    const orderByNode = orderBy("products.name", "ASC")

    const query = {
      select: selectNodes,
      from: fromNode,
      join: [leftJoinNode],
      orderBy: orderByNode,
    }

    expect(query).toEqual({
      select: [
        {
          type: "select",
          expression: { type: "expression", left: "products.id" },
          alias: undefined,
        },
        {
          type: "select",
          expression: { type: "expression", left: "products.name" },
          alias: undefined,
        },
        {
          type: "select",
          expression: { type: "expression", left: "categories.name" },
          alias: undefined,
        },
      ],
      from: { type: "table", name: "products" },
      join: [
        {
          type: "join",
          joinType: "LEFT",
          table: { type: "table", name: "categories" },
          on: {
            type: "expression",
            left: { type: "expression", left: "products.category_id" },
            operator: "=",
            right: { type: "expression", left: "categories.id" },
          },
        },
      ],
      orderBy: { type: "orderby", column: "products.name", direction: "ASC" },
    })
  })

  it("should build a SELECT with INNER JOIN and WHERE condition", () => {
    const selectNodes = select("users.id", "users.name", "orders.total")
    const fromNode = from("users")
    const innerJoinNode = innerJoin("orders", "users.id", "=", "orders.user_id")
    const whereNode = joinWhere(
      "addresses",
      "users.id",
      "=",
      "addresses.user_id",
      "INNER",
    )

    const query = {
      select: selectNodes,
      from: fromNode,
      join: [innerJoinNode, whereNode],
    }

    expect(query).toEqual({
      select: [
        {
          type: "select",
          expression: { type: "expression", left: "users.id" },
          alias: undefined,
        },
        {
          type: "select",
          expression: { type: "expression", left: "users.name" },
          alias: undefined,
        },
        {
          type: "select",
          expression: { type: "expression", left: "orders.total" },
          alias: undefined,
        },
      ],
      from: { type: "table", name: "users" },
      join: [
        {
          type: "join",
          joinType: "INNER",
          table: { type: "table", name: "orders" },
          on: {
            type: "expression",
            left: { type: "expression", left: "users.id" },
            operator: "=",
            right: { type: "expression", left: "orders.user_id" },
          },
        },
        {
          type: "join",
          joinType: "INNER",
          table: { type: "table", name: "addresses" },
          on: {
            type: "expression",
            left: { type: "expression", left: "users.id" },
            operator: "=",
            right: { type: "expression", left: "addresses.user_id" },
          },
        },
      ],
    })
  })

  it("should build a SELECT with GROUP BY and ORDER BY", () => {
    const selectNodes = select(
      "products.category_id",
      "SUM(products.price) as total_price",
    )
    const fromNode = from("products")
    const groupByNode = groupBy("products.category_id")
    const orderByNode = orderBy("total_price", "DESC")

    const query = {
      select: selectNodes,
      from: fromNode,
      groupBy: groupByNode,
      orderBy: orderByNode,
    }

    expect(query).toEqual({
      select: [
        {
          type: "select",
          expression: { type: "expression", left: "products.category_id" },
          alias: undefined,
        },
        {
          type: "select",
          expression: {
            type: "expression",
            left: "SUM(products.price) as total_price",
          },
          alias: undefined,
        },
      ],
      from: { type: "table", name: "products" },
      groupBy: { type: "groupby", columns: ["products.category_id"] },
      orderBy: { type: "orderby", column: "total_price", direction: "DESC" },
    })
  })
})
