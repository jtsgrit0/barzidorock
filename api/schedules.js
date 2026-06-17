const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io'); // GitHub Pages 도메인 허용
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Preflight request. Reply successfully:
    return res.status(200).end();
  }
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`SELECT * FROM schedules ORDER BY event_date DESC;`;
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  } else if (req.method === 'POST') {
    try {
      const { venue_id, event_date, event_name, description, captcha } = req.body;

      if (!venue_id || !event_date || !event_name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captcha}`,
      });

      const recaptchaData = await response.json();

      if (!recaptchaData.success || recaptchaData.score < 0.5) {
          return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }

      await sql`
        INSERT INTO schedules (venue_id, event_date, event_name, description)
        VALUES (${venue_id}, ${event_date}, ${event_name}, ${description});
      `;
      res.status(201).json({ message: 'Schedule created successfully' });
    } catch (error) {
      console.error('Error creating schedule:', error);
      res.status(500).json({ error: 'Failed to create schedule', details: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing schedule ID' });
      }
      await sql`DELETE FROM schedules WHERE id = ${id};`;
      res.status(200).json({ message: 'Schedule deleted successfully' });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      res.status(500).json({ error: 'Failed to delete schedule', details: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, venue_id, event_date, event_name, description } = req.body;
      if (!id || !venue_id || !event_date || !event_name) {
        return res.status(400).json({ error: 'Missing required fields for update' });
      }
      await sql`
        UPDATE schedules
        SET venue_id = ${venue_id}, event_date = ${event_date}, event_name = ${event_name}, description = ${description}
        WHERE id = ${id};
      `;
      res.status(200).json({ message: 'Schedule updated successfully' });
    } catch (error) {
      console.error('Error updating schedule:', error);
      res.status(500).json({ error: 'Failed to update schedule', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};