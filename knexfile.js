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
    connection: process.env.DATABASE_URL + "?ssl=true",
    migrations: {
      directory: './migrations'
    },
    useNullAsDefault: true
  }
};