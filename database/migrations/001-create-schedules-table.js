
const { sql } = require('@vercel/postgres');

async function up() {
  // Create the table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      venue_id VARCHAR(255) NOT NULL,
      event_name TEXT,
      description TEXT,
      event_date TIMESTAMPTZ NOT NULL,
      poster_image_url TEXT,
      ticket_url TEXT,
      source VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  console.log('Migration for "schedules" table completed successfully.');
}

async function down() {
  await sql`DROP TABLE IF EXISTS schedules;`;
  console.log('Dropped "schedules" table.');
}

module.exports = { up, down };