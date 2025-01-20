"use server"

import { Pool } from "pg"
import { json2csv } from "json-2-csv"

class PostgresClient {
  private static client: Pool

  static init() {
    if (!PostgresClient.client) PostgresClient.client = new Pool()
    return PostgresClient.client
  }
  static async query(query: string) {
    const client = PostgresClient.init()
    const res = await client.query(query)
    return res.rows
  }
}

/**
 * ! This is not secure and 100% for testing purposes only
 */
export async function queryPostgres(query: string) {
  const client = PostgresClient.init()
  const res = await client.query(query)
  return res.rows
}

export async function getUserCount() {
  const res = await PostgresClient.query("SELECT COUNT(*) FROM users")
  return res[0].count
}

interface TableColumn {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: "YES" | "NO"
  column_default: string | null
  character_maximum_length: number | null
}

export async function getDatabaseSchema() {
  const schemaQuery = `
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length
    FROM 
      information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE 
      t.table_schema = 'public'
    ORDER BY 
      t.table_name,
      c.ordinal_position;
  `
  const schemaRes: TableColumn[] = await PostgresClient.query(schemaQuery)

  return schemaRes
}

export async function getSchemaString() {
  const schemaRes = await getDatabaseSchema()
  const csv = json2csv(schemaRes)
  return csv
}
