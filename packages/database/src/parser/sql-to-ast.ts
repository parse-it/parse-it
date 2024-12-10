import * as bigQuery from "../grammer/bigquery.pegjs";

export function parseBigQuery(input: string): any {
  return bigQuery.parse(input, {});
}
