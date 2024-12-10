import * as bigQuery from './grammer/bigquery.pegjs';

const result = bigQuery.parse('SELECT * FROM `users`', {});

console.log(result);