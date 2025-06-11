import { isSafeExpressionANDQueryIdentifier } from "../builder/util"
const { Parser } = require("node-sql-parser")

const parser = new Parser()
const SUPPORTED_DB = "bigQuery"
const SQL_ENGINE = "BigQuery" // node-sql-parser uses this exact string
const whiteTableList = ["(select)::(.*)::(.*)"]

type SupportedDatabase = "bigQuery"

function ensureSupportedDB(
  databaseType: string,
): asserts databaseType is SupportedDatabase {
  if (databaseType !== SUPPORTED_DB) {
    throw new Error("Unsupported database type")
  }
}

export function parseBigQuery(input: string) {
  return parser.parse(input, { database: SQL_ENGINE })
}

export function parseSQLToAST(
  sql: string,
  databaseType: SupportedDatabase = SUPPORTED_DB,
): any {
  ensureSupportedDB(databaseType)
  return parser.astify(sql, { database: SQL_ENGINE })
}

export function parseASTtoSQL(
  ast: any,
  databaseType: SupportedDatabase = SUPPORTED_DB,
): string {
  ensureSupportedDB(databaseType)

  const resultSQL = parser.sqlify(ast, { database: SQL_ENGINE })

  if (!isSafeExpressionANDQueryIdentifier(resultSQL)) {
    throw new Error("Invalid SQL query: contains unsafe character")
  }

  try {
    parser.whiteListCheck(resultSQL, whiteTableList, {
      databaseType,
      type: "table",
    })
  } catch {
    throw new Error("Invalid SQL query: whitelist check failed")
  }

  return resultSQL
}
