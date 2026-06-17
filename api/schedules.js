const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }
  
  // Set CORS headers for all other requests
  res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 로그인 상태 검증 함수 (쿠키 확인)
  const isAuthenticated = (cookieHeader) => {
    if (!cookieHeader) return false;
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    return cookies.adminLoggedIn === 'true';
  };
  
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`SELECT * FROM schedules ORDER BY event_date ASC;`;
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  } else if (req.method === 'POST') {
    try {
      // 로그인 상태 검증
      if (!isAuthenticated(req.headers.cookie)) {
        return res.status(401).json({ error: 'Unauthorized: Please login first' });
      }

      const { venue_id, event_date, event_name, description, poster_image, captcha } = req.body;

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
        INSERT INTO schedules (venue_id, event_date, event_name, description, poster_image)
        VALUES (${venue_id}, ${event_date}, ${event_name}, ${description}, ${poster_image});
      `;
      res.status(201).json({ message: 'Schedule created successfully' });
    } catch (error) {
      console.error('Error creating schedule:', error);
      res.status(500).json({ error: 'Failed to create schedule', details: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      // 로그인 상태 검증
      if (!isAuthenticated(req.headers.cookie)) {
        return res.status(401).json({ error: 'Unauthorized: Please login first' });
      }

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
      // 로그인 상태 검증
      if (!isAuthenticated(req.headers.cookie)) {
        return res.status(401).json({ error: 'Unauthorized: Please login first' });
      }

      const { id, venue_id, event_date, event_name, description, poster_image } = req.body;

      if (!id || !venue_id || !event_date || !event_name) {
        return res.status(400).json({ error: 'Missing required fields for update' });
      }
      await sql`
        UPDATE schedules
        SET venue_id = ${venue_id}, event_date = ${event_date}, event_name = ${event_name}, description = ${description}, poster_image = ${poster_image}
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