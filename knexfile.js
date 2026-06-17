module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.NODE_ENV === 'production' ? '/app/database.db' : './database.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    }
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: './database.db'
    },
    useNullAsDefault: true
  }
};