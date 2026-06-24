const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app', 'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }
  
  // Set CORS headers for all other requests
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app', 'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 로그인 상태 및 사용자 정보 검증 함수 (Authorization 헤더의 토큰 확인)
  const getAuthenticatedUser = async (authHeader) => {
    // 관리자 토큰 검증
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === 'admin-secret-token-2026') {
        return { is_admin: true, venue_id: null };
      }
    }
    // 공연장 관리자 쿠키 검증 (기존 로직 유지)
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      if (cookies.venueManagerLoggedIn) {
        const userResult = await sql`
          SELECT venue_id FROM venue_managers WHERE id = ${cookies.venueManagerLoggedIn} AND is_approved = true AND email_verified = true
        `;
        if (userResult.rows.length > 0) {
          return { is_admin: false, venue_id: userResult.rows[0].venue_id, user_id: cookies.venueManagerLoggedIn };
        }
      }
    }
    return null;
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
      // 로그인 상태 및 사용자 정보 검증
      const user = await getAuthenticatedUser(req.headers.authorization);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Please login first' });
      }

      const { venue_id, event_date, event_name, description, poster_image, captcha } = req.body;

      // 공연장 관리자의 경우 자신의 공연장에만 일정 등록 가능
      if (!user.is_admin && user.venue_id !== venue_id) {
        return res.status(403).json({ error: 'Forbidden: You can only create schedules for your own venue' });
      }

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
      // 로그인 상태 및 사용자 정보 검증
      const user = await getAuthenticatedUser(req.headers.authorization);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Please login first' });
      }

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Missing schedule ID' });
      }

      // 공연장 관리자의 경우 삭제하려는 일정이 자신의 공연장 일정인지 확인
      if (!user.is_admin) {
        const schedule = await sql`SELECT venue_id FROM schedules WHERE id = ${id}`;
        if (schedule.rows.length === 0 || schedule.rows[0].venue_id !== user.venue_id) {
          return res.status(403).json({ error: 'Forbidden: You can only delete schedules for your own venue' });
        }
      }

      await sql`DELETE FROM schedules WHERE id = ${id};`;
      res.status(200).json({ message: 'Schedule deleted successfully' });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      res.status(500).json({ error: 'Failed to delete schedule', details: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      // 로그인 상태 및 사용자 정보 검증
      const user = await getAuthenticatedUser(req.headers.authorization);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Please login first' });
      }

      const { id, venue_id, event_date, event_name, description, poster_image } = req.body;

      if (!id || !venue_id || !event_date || !event_name) {
        return res.status(400).json({ error: 'Missing required fields for update' });
      }

      // 공연장 관리자의 경우 수정하려는 일정이 자신의 공연장 일정인지 확인
      if (!user.is_admin) {
        const schedule = await sql`SELECT venue_id FROM schedules WHERE id = ${id}`;
        if (schedule.rows.length === 0 || schedule.rows[0].venue_id !== user.venue_id) {
          return res.status(403).json({ error: 'Forbidden: You can only update schedules for your own venue' });
        }
        // 수정하려는 공연장 ID도 자신의 공연장과 일치하는지 확인
        if (venue_id !== user.venue_id) {
          return res.status(403).json({ error: 'Forbidden: You cannot change the venue ID' });
        }
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