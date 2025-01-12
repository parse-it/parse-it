"use server"

import { Pool } from "pg"

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

export async function getUserCount() {
  const res = await PostgresClient.query("SELECT COUNT(*) FROM users")
  return res[0].count
}
