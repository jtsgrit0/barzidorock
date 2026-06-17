const { sql } = require('@vercel/postgres');

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const handler = async (req, res) => {
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
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};

module.exports = allowCors(handler);