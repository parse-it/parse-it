import pg from "pg"

const { Client } = pg

const client = new Client({
  user: "database-user",
  password: "secretpassword!!",
  host: "my.database-server.com",
  port: 5334,
  database: "database-name",
})
