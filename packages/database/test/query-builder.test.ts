import { describe, expect, it } from "vitest"
import { ASTMapper, parseBigQuery, QueryBuilder } from "../src"
import { conditions, join, orderBy, where } from "../src/builder/helper"
import { QueryBuilderMode } from "../src/builder/parameter.manager"
import { QueryNode } from "../src/types"

describe("QueryBuilder", () => {
  it("should build a select query", () => {
    const queryNode: QueryNode = {
      type: "query",
      selects: ["name", "email"],
      from: "users",
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    expect(queryObject.query).toBe("SELECT name, email FROM users")
  })

  it("should build a select query with a where clause", () => {
    const queryNode: QueryNode = {
      type: "query",
      selects: ["name", "email"],
      from: "users",
      where: where(conditions([{ column: "age", operator: ">", value: 18 }])),
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE age > 18",
    )
  })

  it("should build a select query with a where clause and a limit", () => {
    const queryNode: QueryNode = {
      type: "query",
      selects: ["name", "email"],
      from: "users",
      where: where(conditions([{ column: "age", operator: ">", value: 18 }])),
      orderBy: [],
      limit: 10,
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE age > 18 LIMIT 10",
    )
  })

  it("should build a select query with a where clause and a limit and an offset", () => {
    const queryNode: QueryNode = {
      type: "query",
      selects: ["name", "email"],
      from: "users",
      where: where(conditions([{ column: "age", operator: ">", value: 18 }])),
      orderBy: [],
      limit: 10,
      offset: 5,
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE age > 18 LIMIT 10 OFFSET 5",
    )
  })

  it("should build a select query with a where clause and a limit and an offset and an order by", () => {
    const queryNode: QueryNode = {
      type: "query",
      selects: ["name", "email"],
      from: "users",
      where: where(conditions([{ column: "age", operator: ">", value: 18 }])),
      orderBy: [orderBy("name")],
      limit: 10,
      offset: 5,
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE age > 18 ORDER BY name DESC LIMIT 10 OFFSET 5",
    )
  })

  it("should build a select query with a where clause and a limit and an offset and an order by and a group by", () => {
    const queryNode: QueryNode = {
      type: "query",
      selects: ["name", "email"],
      from: "users",
      where: where(conditions([{ column: "age", operator: ">", value: 18 }])),
      groupBy: "name",
      orderBy: [orderBy("name")],
      limit: 10,
      offset: 5,
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE age > 18 GROUP BY name ORDER BY name DESC LIMIT 10 OFFSET 5",
    )
  })

  it("should build a select query with a join", () => {
    const queryNode: QueryNode = {
      type: "query",
      selects: ["name", "email"],
      from: "users",
      joins: [join("orders", "users.id", "=", "orders.user_id")],
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users JOIN orders ON users.id = orders.user_id",
    )
  })

  it("should convert SQL to QueryNode", () => {
    const sql = `SELECT name, email FROM users WHERE age > 18 AND name = 'John' OR (age < 18 AND name = 'Doe' OR (age = 18 AND name = 'Smith'))`
    const mapper = new ASTMapper()
    const mappedAST = mapper.map(parseBigQuery(sql))
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(mappedAST)

    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE (age > 18 AND name = 'John') OR (age < 18 AND name = 'Doe') OR (age = 18 AND name = 'Smith')",
    )
  })
})
