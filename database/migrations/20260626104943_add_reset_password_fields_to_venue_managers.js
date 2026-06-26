module.exports = {
  up: async (sql) => {
    await sql`
      ALTER TABLE venue_managers
      ADD COLUMN reset_password_token TEXT,
      ADD COLUMN reset_password_expires TIMESTAMP WITH TIME ZONE;
    `;
  },
  down: async (sql) => {
    await sql`
      ALTER TABLE venue_managers
      DROP COLUMN reset_password_token,
      DROP COLUMN reset_password_expires;
    `;
  },
};