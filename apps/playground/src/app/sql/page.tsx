"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { executeQuery } from "./actions"

export default function SQLQueryPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>SQL Query Executor</CardTitle>
        </CardHeader>
        <Form />
      </Card>
    </div>
  )
}

function Form() {
  const [result, setResult] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const query = formData.get("query") as string
    const res = await executeQuery(query)
    console.log(res)
    setResult(JSON.stringify(res, null, 2))
  }

  return (
    <form
      action={handleSubmit}
      onSubmit={(e) => {
        // Prevents form from being cleared
        e.preventDefault()
        handleSubmit(new FormData(e.currentTarget))
      }}
    >
      <CardContent>
        <Textarea
          name="query"
          placeholder="Enter your SQL query here..."
          className="min-h-[200px]"
        />
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button type="submit">Execute Query</Button>
      </CardFooter>
      {result && (
        <CardContent>
          <Card>
            <CardHeader>
              <CardTitle>Query Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap overflow-auto max-h-[400px]">
                {result}
              </pre>
            </CardContent>
          </Card>
        </CardContent>
      )}
    </form>
  )
}
