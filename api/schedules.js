const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    if (req.method === 'GET') {
      const { rows: schedules } = await sql`
        SELECT * FROM schedules ORDER BY event_date DESC;
      `;
      res.status(200).json(schedules);
    } else if (req.method === 'POST') {
      const { venue_id, event_name, description, event_date, poster_image_url, ticket_url, source } = req.body;
      await sql`
        INSERT INTO schedules (venue_id, event_name, description, event_date, poster_image_url, ticket_url, source)
        VALUES (${venue_id}, ${event_name}, ${description}, ${event_date}, ${poster_image_url}, ${ticket_url}, ${source});
      `;
      res.status(201).json({ success: true });
    }
  } catch (error) {
    console.error('Error handling schedules API:', error);
    res.status(500).json({ error: 'Failed to process schedules request', details: error.message });
  }
};