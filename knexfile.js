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
    client: 'better-sqlite3',
    connection: {
      filename: '/app/data/database.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    }
  }
};