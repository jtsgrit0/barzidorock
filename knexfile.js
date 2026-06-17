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
    connection: process.env.DATABASE_URL 
      ? process.env.DATABASE_URL + "?ssl=true"
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