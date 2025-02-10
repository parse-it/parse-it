import { z } from "zod"

// Example database schema
export const schema = {
  users: {
    id: "INTEGER PRIMARY KEY",
    name: "TEXT",
    email: "TEXT",
    created_at: "TIMESTAMP",
  },
  orders: {
    id: "INTEGER PRIMARY KEY",
    user_id: "INTEGER",
    total_amount: "DECIMAL(10, 2)",
    status: "TEXT",
    created_at: "TIMESTAMP",
  },
}

// Mock database for demonstration purposes
const mockDatabase = {
  users: [
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      created_at: "2023-01-01 10:00:00",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      created_at: "2023-01-02 11:00:00",
    },
  ],
  orders: [
    {
      id: 1,
      user_id: 1,
      total_amount: 100.5,
      status: "completed",
      created_at: "2023-01-03 12:00:00",
    },
    {
      id: 2,
      user_id: 2,
      total_amount: 75.25,
      status: "pending",
      created_at: "2023-01-04 13:00:00",
    },
  ],
}

// SQL execution tool
export async function executeSql(sql: string): Promise<any> {
  console.log("Executing SQL:", sql)

  // Simple SQL parser (for demonstration purposes)
  const lowerSql = sql.toLowerCase()
  if (lowerSql.startsWith("select")) {
    const tableName = lowerSql.includes("from users") ? "users" : "orders"
    return mockDatabase[tableName]
  }

  return { message: "Query executed successfully" }
}

// Zod schema for SQL execution tool
export const sqlExecutionSchema = z.object({
  sql: z.string().describe("The SQL query to execute"),
})
