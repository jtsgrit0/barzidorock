module.exports = {
  up: async (sql) => {
    await sql`
      ALTER TABLE venue_managers
      ADD COLUMN IF NOT EXISTS reset_password_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;
    `;
  },
  down: async (sql) => {
    await sql`
      ALTER TABLE venue_managers
      DROP COLUMN IF EXISTS reset_password_token,
      DROP COLUMN IF EXISTS reset_password_expires;
    `;
  },
};