import * as bigQuery from "../grammar/bigquery.pegjs"

export function parseBigQuery(
  input: string,
  databaseType?: "bigQuery" | "MySQL",
): any {
  return bigQuery.parse(input, {})
}
