
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
  console.log('Ensured "schedules" table exists.');

  // Add the unique constraint in a way that is safe to re-run
  try {
    await sql`
      ALTER TABLE schedules
      ADD CONSTRAINT unique_schedule_per_venue_date UNIQUE (venue_id, event_date);
    `;
    console.log('Added unique constraint to "schedules" table.');
  } catch (error) {
    if (error.code === '42P07') { // 42P07 is the error code for "duplicate_object"
      console.log('Unique constraint "unique_schedule_per_venue_date" already exists, skipping.');
    } else {
      // If it's a different error, we should not ignore it
      throw error;
    }
  }

  console.log('Migration for "schedules" table completed successfully.');
}

async function down() {
  await sql`DROP TABLE IF EXISTS schedules;`;
  console.log('Dropped "schedules" table.');
}

module.exports = { up, down };