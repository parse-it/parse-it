import * as bigQuery from './grammer/bigquery.pegjs';

const result = bigQuery.parse(`SELECT COUNT(CustomerID)
FROM Customers
GROUP BY Country;`, {});

console.dir(result, { depth: null });