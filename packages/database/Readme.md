# @parse-it/database

[![npm version](https://badge.fury.io/js/@parse-it%2Fdatabase.svg)](https://badge.fury.io/js/@parse-it%2Fdatabase)
[![Build Status](https://github.com/parse-it/parse-it/actions/workflows/release.yml/badge.svg)](https://github.com/parse-it/parse-it/actions)

A simple query builder for TypeScript, designed to work with BigQuery and PostgresSQL.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## Installation

You can install the package using npm:

```sh
npm install @parse-it/database
```

## Usage

Here is a basic example of how to use the query builder:

```ts
import { QueryBuilder, QueryBuilderMode } from "@parse-it/database";
import { parseBigQuery } from "@parse-it/database";

// Sample SQL query
const sqlQuery = `
WITH RegisteredUsers AS (
    SELECT 
        id,
        registrationDate
    FROM UserSnapshots
    WHERE status = 'Active' 
      AND registrationDate IS NOT NULL
),
EarliestRegistrationDates AS (
    SELECT 
        id,
        MIN(registrationDate) AS earliestRegistrationDate
    FROM RegisteredUsers
    GROUP BY id
),
CurrentlyActiveUsers AS (
    SELECT 
        id
    FROM UserSnapshots
    WHERE status = 'Active'
    GROUP BY id
)
SELECT 
    DATEDIFF(DAY, e.earliestRegistrationDate, GETDATE()) AS daysSinceRegistration
FROM EarliestRegistrationDates e
JOIN CurrentlyActiveUsers c
  ON e.id = c.id;`

const queryNode = parseBigQuery(sqlQuery);

const queryBuilder = new QueryBuilder(QueryBuilderMode.NAMED);
const query = queryBuilder.build(queryNode);

console.log(query);
```

## API

### `parseBigQuery(input: string, databaseType?: 'bigQuery' | 'MySQL'): any`

Parses the given SQL query string and returns an abstract syntax tree (AST).

### `QueryBuilder`

#### `constructor(mode: QueryBuilderMode)`

Creates a new instance of the `QueryBuilder`.

#### `build(queryNode: QueryNode): string`

Builds the SQL query string from the given query node.

### `QueryBuilderMode`

An enumeration of the query builder modes:
- `SIMPLE`
- `NAMED`
- `POSITIONAL`

## Contributing

We welcome contributions! Please read our [Contributing Guide](https://github.com/parse-it/parse-it/blob/main/CONTRIBUTING.md) to learn how you can help.

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/parse-it/parse-it/blob/main/LICENSE) file for details.