
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

  // Check if the unique constraint already exists before trying to add it
  const { rows: constraints } = await sql`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'schedules' AND constraint_name = 'unique_schedule_per_venue_date';
  `;

  if (constraints.length === 0) {
    await sql`
      ALTER TABLE schedules
      ADD CONSTRAINT unique_schedule_per_venue_date UNIQUE (venue_id, event_date);
    `;
    console.log('Added unique constraint to "schedules" table.');
  } else {
    console.log('Unique constraint "unique_schedule_per_venue_date" already exists.');
  }

  console.log('Migration for "schedules" table completed.');
}

async function down() {
  await sql`DROP TABLE IF EXISTS schedules;`;
  console.log('Dropped "schedules" table.');
}

module.exports = { up, down };