import { CoreMessage, streamText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { executeSql, schema, sqlExecutionSchema } from "@/lib/database"
import { getSchemaString, queryPostgres } from "@/app/services/postgres"

/**
 * TODO: Replace with more sophisticated langgraph-based approach
 * TODO: Consider server actions instead
 */

export async function POST(req: Request) {
  const { messages }: { messages: CoreMessage[] } = await req.json()
  console.log("messages", messages)

  const schemaString = await getSchemaString()
  console.log({ schemaString })

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `You are a helpful assistant with access to a database. 
    The database schema is as follows:
    ${schemaString}
    
    When asked about data, generate appropriate SQL queries to fetch the information.
    Use the executeSql tool to run the queries and provide answers based on the results.`,
    messages,
    tools: {
      executeSql: executeSqlTool,
    },
    maxSteps: 3,
  })

  return result.toDataStreamResponse()
}

const executeSqlTool = tool({
  description: "Execute an SQL query on the database",
  parameters: sqlExecutionSchema,
  execute: async ({ sql }) => {
    console.log("executeSqlTool", { sql })
    const queryRes = await queryPostgres(sql)
    console.log({ queryRes })

    return queryRes
  },
})
