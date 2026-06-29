
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { sql } = require('@vercel/postgres');
const { put } = require('@vercel/blob');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // 메모리에 파일을 저장

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

const corsOptionsCredentials = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://jtsgrit0.github.io',
      'https://barzidorock.vercel.app',
    ];
    if (!origin || allowedOrigins.includes(origin) || /barzidorock.*\.vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

const apiRouter = express.Router();

apiRouter.get('/rollinghall-events', cors(), async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const result = await fetchRollingHallEvents();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /api/rollinghall-events endpoint:', error);
    res.status(500).json({ events: [], error: 'Failed to fetch Rolling Hall events.', debug: `Caught error in endpoint: ${error.message}` });
  }
});

const secureRouter = express.Router();
secureRouter.use(cors(corsOptionsCredentials));

secureRouter.get('/schedules', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM schedules ORDER BY event_date ASC;`;
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
  }
});

secureRouter.post('/schedules/upload', upload.single('file'), async (req, res) => {
  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  try {
    const blob = await put(filename, req.file.buffer, {
      access: 'private',
      contentType: req.file.mimetype,
    });
    res.status(200).json(blob);
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

secureRouter.post('/schedules', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Please login first' });
    }

    const { venue_id, event_date, event_name, description, poster_image_url } = req.body;

    if (!user.is_admin && user.venue_id !== venue_id) {
      return res.status(403).json({ error: 'Forbidden: You can only create schedules for your own venue' });
    }

    if (!venue_id || !event_date || !event_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await sql`
      INSERT INTO schedules (venue_id, event_date, event_name, description, poster_image)
      VALUES (${venue_id}, ${event_date}, ${event_name}, ${description}, ${poster_image_url});
    `;
    res.status(201).json({ message: 'Schedule created successfully' });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule', details: error.message });
  }
});

secureRouter.delete('/schedules/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Please login first' });
    }

    const { id } = req.params;

    const scheduleResult = await sql`SELECT venue_id FROM schedules WHERE id = ${id}`;
    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (!user.is_admin && user.venue_id !== scheduleResult.rows[0].venue_id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete schedules for your own venue' });
    }

    await sql`DELETE FROM schedules WHERE id = ${id};`;
    res.status(200).json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule', details: error.message });
  }
});

secureRouter.put('/schedules/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Please login first' });
    }

    const { id } = req.params;
    const { venue_id, event_date, event_name, description, poster_image_url } = req.body;

    const scheduleResult = await sql`SELECT venue_id FROM schedules WHERE id = ${id}`;
    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (!user.is_admin && user.venue_id !== scheduleResult.rows[0].venue_id) {
      return res.status(403).json({ error: 'Forbidden: You can only update schedules for your own venue' });
    }

    await sql`
      UPDATE schedules
      SET venue_id = ${venue_id}, event_date = ${event_date}, event_name = ${event_name}, description = ${description}, poster_image = ${poster_image_url}
      WHERE id = ${id};
    `;
    res.status(200).json({ message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule', details: error.message });
  }
});

secureRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
  }

  // 관리자 계정 확인
  if (email === 'jtsgrit0@gmail.com' && password === 'Ggdrecon3534@.!') {
    res.cookie('isAdmin', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.status(200).json({ message: '관리자 로그인 성공' });
  }

  try {
    const result = await sql`
      SELECT id, password_hash, is_approved, email_verified FROM venue_managers WHERE email = ${email}
    `;

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = result.rows[0];

    if (!user.is_approved) {
      return res.status(403).json({ error: '관리자 승인을 기다리고 있는 계정입니다.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: '이메일 인증이 완료되지 않았습니다.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    res.cookie('venueManagerLoggedIn', user.id, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    res.status(200).json({ message: '로그인 성공' });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 중 서버 오류가 발생했습니다.' });
  }
});

const forgotPasswordHandler = require('./api/auth/forgot-password');
secureRouter.post('/auth/forgot-password', (req, res) => forgotPasswordHandler(req, res));

const resetPasswordHandler = require('./api/auth/reset-password');
secureRouter.post('/auth/reset-password', (req, res) => resetPasswordHandler(req, res));

apiRouter.use(secureRouter);
app.use('/api', apiRouter);

const getAuthenticatedUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === 'admin-secret-token-2026') {
      return { is_admin: true, venue_id: null };
    }
  }
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

async function fetchTicketUrl(event, debugMessages) {
  const fullDetailPageUrl = `https://www.rollinghall.co.kr${event.detailPageLink}`;
  let ticketUrl = '';
  debugMessages.push(`  Fetching detail page: ${fullDetailPageUrl}`);

  try {
    const detailResponse = await fetch(fullDetailPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!detailResponse.ok) {
      debugMessages.push(`Failed to fetch detail page ${fullDetailPageUrl}: ${detailResponse.status} ${detailResponse.statusText}`);
      ticketUrl = fullDetailPageUrl;
    } else {
      const detailArrayBuffer = await detailResponse.arrayBuffer();
      const detailBuffer = Buffer.from(detailArrayBuffer);
      const detailHtml = iconv.decode(detailBuffer, 'EUC-KR');
      const detail$ = cheerio.load(detailHtml);

      const melonTicketLink = detail$('a[href*="ticket.melon.com"]').attr('href');
      if (melonTicketLink) {
        ticketUrl = melonTicketLink;
        debugMessages.push(`  Extracted melonTicketLink: ${ticketUrl}`);
      } else {
        const ticketTd = detail$('td:contains("예매하기")');
        if (ticketTd.length > 0) {
          const nextTd = ticketTd.next('td');
          const ticketLink = nextTd.find('a').attr('href');
          if (ticketLink) {
            ticketUrl = ticketLink;
            debugMessages.push(`  Extracted ticketUrl from next td: ${ticketUrl}`);
          } else {
            const nextText = nextTd.text().trim();
            const urlMatch = nextText.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
              ticketUrl = urlMatch[0];
              debugMessages.push(`  Extracted ticketUrl from text: ${ticketUrl}`);
            }
          }
        }
      }
    }
  } catch (detailError) {
    debugMessages.push(`Error fetching or parsing detail page for ${fullDetailPageUrl}: ${detailError.message}`);
    ticketUrl = fullDetailPageUrl;
  }

  const { detailPageLink, ...rest } = event;
  return { ...rest, ticketUrl: ticketUrl || fullDetailPageUrl };
}

async function fetchRollingHallEvents() {
  const url = 'https://www.rollinghall.co.kr/default/mp3/mp3_sub2.php?sub=02';
  const debugMessages = [];

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      const errorMsg = `Failed to fetch main page: ${response.status} ${response.statusText}`;
      debugMessages.push(errorMsg);
      return { events: [], error: errorMsg, debug: debugMessages.join('\n') };
    }
    const arrayBuffer = await response.arrayBuffer();
    const html = iconv.decode(Buffer.from(arrayBuffer), 'EUC-KR');
    const $ = cheerio.load(html);

    const allRows = $('tr');
    debugMessages.push(`Found ${allRows.length} total table rows.`);

    const preliminaryEvents = [];
    allRows.each((i, row) => {
      const linkInRow = $(row).find('a[href*="com_board_basic=read_form"]');
      if (linkInRow.length === 0) return;

      const textInRow = $(row).text().trim();
      if (!textInRow) return;

      const detailPageLink = $(linkInRow).attr('href');
      const dateMatch = textInRow.match(/(\d{4})\S+\s*(\d{2})\S+\s*(\d{2})\S+/);
      let date = '';
      if (dateMatch) date = `${dateMatch[1]}년 ${dateMatch[2]}월 ${dateMatch[3]}일`;
      if (!detailPageLink || !date) return;

      let cleanTitle = textInRow.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ');
      cleanTitle = cleanTitle.replace(/\[.*OCR.*\]/gi, '').replace(/\[.*추출.*텍스트\]/gi, '');
      const dateRegex = /\d{4}년\s*\d{2}월\s*\d{2}일/gi;
      const firstDateMatch = cleanTitle.match(dateRegex);
      if (firstDateMatch && firstDateMatch.length > 1) {
        const firstDateIndex = cleanTitle.indexOf(firstDateMatch[0]);
        const secondDateIndex = cleanTitle.indexOf(firstDateMatch[1]);
        if (secondDateIndex > firstDateIndex) {
          cleanTitle = cleanTitle.substring(firstDateIndex, secondDateIndex).trim();
        }
      }
      cleanTitle = cleanTitle.trim().substring(0, 100);
      
      let image = null;
      const imgInRow = $(row).find('img');
      if (imgInRow.length > 0) {
        const rawImgSrc = imgInRow.attr('src');
        if (rawImgSrc.startsWith('http')) {
          image = rawImgSrc;
        } else if (rawImgSrc.startsWith('/')) {
          image = `https://www.rollinghall.co.kr${rawImgSrc}`;
        } else {
          image = `https://www.rollinghall.co.kr/${rawImgSrc}`;
        }
      }

      if (!preliminaryEvents.find(e => e.detailPageLink === detailPageLink)) {
        preliminaryEvents.push({
          id: `rh-${preliminaryEvents.length + 1}`,
          title: cleanTitle,
          date,
          detailPageLink,
          image: image || `https://picsum.photos/400/300?random=${preliminaryEvents.length + 1}`
        });
      }
    });

    debugMessages.push(`Successfully scraped ${preliminaryEvents.length} preliminary events.`);

    const limitedEvents = preliminaryEvents.slice(0, 10);
    debugMessages.push(`Processing ${limitedEvents.length} events (limited to prevent timeout).`);
    
    const ticketUrlPromises = limitedEvents.map(event => fetchTicketUrl(event, debugMessages));
    const events = await Promise.all(ticketUrlPromises);

    debugMessages.push(`Finished scraping. Total events found: ${events.length}`);
    return { events, debug: debugMessages.join('\n') };

  } catch (error) {
    const errorMsg = `Error in fetchRollingHallEvents: ${error.message}`;
    debugMessages.push(errorMsg);
    console.error(errorMsg, error.stack);
    const dummyEvents = [
      {
        id: 'rh-dummy-1',
        title: 'Rolling Hall Live Concert (Fallback)',
        date: '2026년 07월 15일',
        image: 'https://picsum.photos/400/300?random=999',
        ticketUrl: 'https://www.rollinghall.co.kr'
      }
    ];
    return { events: dummyEvents, error: errorMsg, debug: debugMessages.join('\n') };
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});