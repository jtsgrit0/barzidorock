
const { sql } = require('@vercel/postgres');

async function up(sql) {
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
  // Add a unique constraint to prevent duplicate entries
  await sql`
    ALTER TABLE schedules
    ADD CONSTRAINT unique_schedule_per_venue_date UNIQUE (venue_id, event_date);
  `;
  console.log('Created "schedules" table and added unique constraint.');
}

async function down(sql) {
  await sql`DROP TABLE IF EXISTS schedules;`;
  console.log('Dropped "schedules" table.');
}

module.exports = { up, down };