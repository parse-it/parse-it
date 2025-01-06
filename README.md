# ParseIt

# Tasks

- [ ] Add tests
- [ ] GHA publishing
- [ ] Documentation
- [ ] More DB implementations - currently tied to BigQuery - e.g. Postgres
- [ ] NextJs app - app based routing
- [ ] DB Engine - wrap dbs like bigquery and/or postgres - let users select - once init, should be agnostic
- [ ]

# Design

Rough Design notes to guide us as we build.

## Setup

User connects their DB to ParseIt and provides some context (if applicable).
ParseIt retrieves the schema. Describes the tables and columns. User can edit these descriptions.
Descriptions are stored in a knowledge base for RAG.

## Querying

User asks a question - > we fetch the relevant information from the knowledge base.
The LLM receives the query and retrieved information and generates a SQL query.
User validates and we perform a dry run on the DB.
We execute the query against the DB and return the results.
If the user likes the results, the user can store the query.
Optionally we use data to display a chart based on user needs.

## RAG

Schema understanding -> RAG of some description

## LLM

User asks question -> Generate SQL

Options:

1. Question -> AST -> SQL
2. Question -> SQL -> AST to validate -> SQL
   We need to eval which is best

## Structure

AI Package:

- Given a schema and a question, generate validated SQL
- Enable back & forth chat to refine the SQL

DB Client Package:

- Gets Schema for the DB
-

App: Chatbot interface
