require("dotenv").config();

// TODO: knex not working with post/username/password
// const { DB_HOST, DB_USERNAME, DB_PASSWORD } = process.env;

module.exports = {
  development: {
    client: "pg",
    connection: "postgres://postgres:postgres@localhost/possession_dev",
    migrations: {
      directory: __dirname + "/db/migrations"
    },
    seeds: {
      directory: __dirname + "/db/seeds/development"
    }
  },
  production: {
    client: "pg",
    // connection: process.env.DATABASE_URL,
    connection: "postgres://postgres:postgres@localhost/possession_dev",
    migrations: {
      directory: __dirname + "/db/migrations"
    },
    seeds: {
      directory: __dirname + "/db/seeds/production"
    }
  }
}
