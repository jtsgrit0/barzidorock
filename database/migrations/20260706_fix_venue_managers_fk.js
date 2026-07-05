module.exports = {
  up: async (sql) => {
    await sql`
      ALTER TABLE venue_managers
      DROP CONSTRAINT IF EXISTS venue_managers_venue_id_fkey
    `;
  },
  down: async () => {},
};
