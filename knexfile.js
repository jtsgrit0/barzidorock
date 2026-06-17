module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: './database.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    }
  },
  production: {
    client: 'pg',
    connection: process.env.POSTGRES_CONNECTION_STRING
      ? process.env.POSTGRES_CONNECTION_STRING + "?ssl=true"
      : {
          host: process.env.PGHOST,
          port: process.env.PGPORT,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE,
          ssl: { rejectUnauthorized: false }
        },
    migrations: {
      directory: './migrations'
    },
    useNullAsDefault: true
  }
};