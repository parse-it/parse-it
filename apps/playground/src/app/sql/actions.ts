"use server"

import { queryPostgres } from "../services/postgres"

export async function executeQuery(query: string) {
  try {
    const result = await queryPostgres(query)
    return { success: true, data: result }
  } catch (error) {
    console.error("Error executing query:", error)
    return { success: false, error: (error as Error).message }
  }
}
