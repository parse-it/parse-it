import { QueryBuilder, QueryBuilderMode } from "./builder/query-builder";
import { ASTMapper } from "./parser/ast-mapper";
import { parseBigQuery } from "./parser/sql-to-ast";

export * from "./builder/query-builder";
export * from "./parser/sql-to-ast";


const a = `
WITH PublishedPosts AS (
    SELECT 
        id,
        publishedDate
    FROM JobPostSnapshots
    WHERE status = 'Published' 
      AND publishedDate IS NOT NULL
),
EarliestPublishedDates AS (
    SELECT 
        id,
        MIN(publishedDate) AS earliestPublishedDate
    FROM PublishedPosts
    GROUP BY id
),
CurrentlyPublishedPosts AS (
    SELECT 
        id
    FROM JobPostSnapshots
    WHERE status = 'Published'
    GROUP BY id
)
SELECT 
    aa AS maxDaysOpen
FROM EarliestPublishedDates e
JOIN CurrentlyPublishedPosts c
  ON e.id = c.id;`

  const query1 = `SELECT word, word_count
        FROM \`bigquery-public-data.samples.shakespeare\`
        WHERE corpus = romeoandjuliet
        AND word_count >= 250
        ORDER BY word_count DESC`

const mapper = new ASTMapper();
const queryNode = mapper.map(parseBigQuery(query1));

const queryBuilder = new QueryBuilder(QueryBuilderMode.NAMED);
console.dir(queryNode, { depth: null });

const query = queryBuilder.build(queryNode);

console.log(query);
