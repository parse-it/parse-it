import { describe, expect, it } from "vitest"
import { ASTMapper, parseBigQuery, QueryBuilder } from "../src"
import {
  conditions,
  groupBy,
  join,
  leftJoin,
  orderBy,
  select,
  updateOrAddCondition,
  where,
} from "../src/builder/helper"
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
      where: {
        type: "filter",
        operator: "AND",
        conditions: [
          where(
            [
              conditions(
                [
                  { column: "active", operator: "=", value: true },
                  { column: "age", operator: ">", value: 18 },
                ],
                "OR",
              ),
              conditions([{ column: "age", operator: ">", value: 18 }]),
            ],
            "OR",
          ),
          conditions([{ column: "status", operator: "=", value: "P" }]),
        ],
      },
      groupBy: "name",
      orderBy: [orderBy("name")],
      limit: 10,
      offset: 5,
    }

    const operationWhiteListCheck = (columnsOrTables: string[]) => {
      return columnsOrTables.every((entry) => {
        return entry.trim().toLowerCase().startsWith("select::")
      })
    }
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(queryNode)
    const parsedAST = parseBigQuery(queryObject.query)
    const valid = operationWhiteListCheck([
      ...parsedAST.columnList,
      ...parsedAST.tableList,
    ])
    if (!valid) {
      throw new Error("Invalid SQL query")
    }
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE (active = true OR age > 18 OR age > 18) AND status = 'P' GROUP BY name ORDER BY name DESC LIMIT 10 OFFSET 5",
    )
  })

  it("should convert SQL to QueryNode", () => {
    const sql = `SELECT name, email FROM users WHERE age > 18 AND name = 'John' OR (age < 18 AND name = 'Doe' OR (age = 18 AND name = 'Smith'))`
    const mapper = new ASTMapper()
    const mappedAST = mapper.map(parseBigQuery(sql))
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(mappedAST)
    // console.dir(queryObject.query, { depth: null })
    expect(queryObject.query).toBe(
      "SELECT name, email FROM users WHERE (age > 18 AND name = 'John') OR (age < 18 AND name = 'Doe') OR (age = 18 AND name = 'Smith')",
    )
  })
  it("should convert SQL to QueryNode1", () => {
    const sql = `WITH
  job_post_visitors AS (
  SELECT
    REGEXP_EXTRACT(a.page_location, '/job/([^/?]+)') AS jobPostId,
    COUNT(
      CASE
        WHEN a.event_name = 'page_view' THEN a.user_pseudo_id
    END
      ) AS views,
    COUNT(
      CASE
        WHEN a.event_name = 'apply_job_link_clicked' THEN a.user_pseudo_id
    END
      ) AS applicationStarted,
    a.customerKey,
    j.jobTitle
  FROM
    reporting.careers_page_analytics_expanded AS a
  INNER JOIN
    reporting.job_post_custom_job_post_detail AS j
  ON
    REGEXP_EXTRACT(a.page_location, '/job/([^/?]+)') = j.id
  WHERE
    a.customerKey IS NOT NULL
    AND REGEXP_EXTRACT(a.page_location, '/job/([^/?]+)') IS NOT NULL
  GROUP BY
    a.customerKey,
    jobPostId,
    j.jobTitle ),
  j_post AS (
  SELECT
    JSON_VALUE(j.jobPostId) AS jobPostId,
    COUNT(1) as applicationSubmited
  FROM
    reporting.jobs_job_post__jobs_job_application_expanded_latest j
  WHERE
    JSON_VALUE(j.candidateSource) IS NULL
  GROUP BY
    jobPostId)
SELECT
  a.*, app.*
FROM
  job_post_visitors a
LEFT JOIN
  j_post AS app
ON
  a.jobPostId = app.jobPostId`
    const mapper = new ASTMapper()
    const parsedAST = parseBigQuery(sql)
    const mappedAST = mapper.map(parsedAST)
    const queryBuilder = new QueryBuilder(QueryBuilderMode.SIMPLE)
    const queryObject = queryBuilder.build(mappedAST)
    // console.dir(queryObject.query, { depth: null })
  })
})
