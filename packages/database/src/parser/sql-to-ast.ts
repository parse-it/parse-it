import * as bigQuery from "../grammar/bigquery.pegjs"

const { Parser } = require("node-sql-parser")
const parser = new Parser()

export function parseBigQuery(
  input: string,
  databaseType?: "bigQuery" | "MySQL",
) {
  return parser.parse(input, {
    database: "BigQuery",
  })
}

export function parseSQLToAST(
  sql: string,
  databaseType: "bigQuery" | "MySQL" = "bigQuery",
): any {
  if (databaseType === "bigQuery") {
    return parser.astify(sql, {
      database: "BigQuery",
    })
  } else {
    throw new Error("Unsupported database type")
  }
}

export function parseASTtoSQL(
  ast: any,
  databaseType: "bigQuery" | "MySQL" = "bigQuery",
): string {
  if (databaseType === "bigQuery") {
    return parser.sqlify(ast, {
      database: "BigQuery",
    })
  } else {
    throw new Error("Unsupported database type")
  }
}
