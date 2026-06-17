const { sql } = require('@vercel/postgres');
const cors = require('cors');

const corsWithOptions = cors({ origin: '*' });

module.exports = async (req, res) => {
  corsWithOptions(req, res, async () => {
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
        const { name, event_date, location, latitude, longitude } = req.body;

        if (!name || !event_date || !location || !latitude || !longitude) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${req.body.token}`,
        });

        const recaptchaData = await response.json();

        if (!recaptchaData.success || recaptchaData.score < 0.5) {
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
        }

        await sql`
          INSERT INTO schedules (name, event_date, location, latitude, longitude)
          VALUES (${name}, ${event_date}, ${location}, ${latitude}, ${longitude});
        `;
        res.status(201).json({ message: 'Schedule created successfully' });
      } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  });
};