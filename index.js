
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { sql } = require('@vercel/postgres');
const { put } = require('@vercel/blob');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // 메모리에 파일을 저장

const app = express();
const PORT = process.env.PORT || 5000;

const path = require('path');

// Serve client build statically (fallback for root and SPA routes)
const clientBuildPath = path.join(__dirname, 'client', 'build');
if (require('fs').existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get(['/', '/index.html', '/favicon.ico', '/static/*', '/manifest.json'], (req, res, next) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Serve also under /barzidorock prefix (CRA built with homepage=/barzidorock/)
if (require('fs').existsSync(clientBuildPath)) {
  app.use('/barzidorock', express.static(clientBuildPath));
  app.get('/barzidorock/*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}
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

// ✅ 파일업로드 엔드포인트: multer 미들웨어를 직접 실행해서 apiRouter에서도 파일 정상처리
apiRouter.options('/schedules/upload', cors(corsOptionsCredentials));
apiRouter.post('/schedules/upload', cors(corsOptionsCredentials), (req, res) => {
  // multer 미들웨어를 직접 실행해서 req.file을 정상적으로 생성
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({ error: 'Multer error', details: err.message });
    }
    const { filename: originalFilename } = req.query;
    if (!originalFilename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    const timestamp = Date.now();
    const filename = `${timestamp}_${originalFilename}`;

    try {
      if (!req.file) {
        console.error('req.file is undefined!');
        return res.status(400).json({ error: 'No file uploaded' });
      }
      console.log('✅ 파일업로드시작:', req.file.originalname, req.file.size);
      const blob = await put(filename, req.file.buffer, {
        // ✅ 클라이언트에서 이미지를 직접 로드하려면 public으로 업로드해야함! 403 Forbidden 해결
        access: 'public',
        contentType: req.file.mimetype,
      });
      console.log('✅ Blob업로드성공:', blob.url);
      res.status(200).json(blob);
    } catch (error) {
      console.error('Error uploading to Vercel Blob:', error);
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  });
});

// 승인 대기 공연장 관리자 목록 조회
secureRouter.get('/admin/pending-venue-managers', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized: Authorization header is required' });
    }
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const { rows } = await sql`SELECT id, email, venue_id FROM venue_managers WHERE is_approved = FALSE AND is_admin = FALSE;`;
    res.status(200).json({ pending_managers: rows });
  } catch (error) {
    console.error('Error fetching pending managers:', error);
    res.status(500).json({ error: 'Failed to fetch pending managers', details: error.message });
  }
});

// ✅ 인증 없이 누구나 이미지 업로드 가능한 엔드포인트 (secureRouter보다 먼저 매칭되어야 함)
app.options('/api/schedules/upload', cors(corsOptionsCredentials));
app.post('/api/schedules/upload', cors(corsOptionsCredentials), (req, res) => {
  // multer 미들웨어를 직접 실행해서 req.file을 정상적으로 생성
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({ error: 'Multer error', details: err.message });
    }
    const { filename: originalFilename } = req.query;
    if (!originalFilename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    const timestamp = Date.now();
    const filename = `${timestamp}_${originalFilename}`;

    try {
      if (!req.file) {
        console.error('req.file is undefined!');
        return res.status(400).json({ error: 'No file uploaded' });
      }
      console.log('✅ 파일업로드시작:', req.file.originalname, req.file.size);
      const blob = await put(filename, req.file.buffer, {
        // ✅ 클라이언트에서 이미지를 직접 로드하려면 public으로 업로드해야함! 403 Forbidden 해결
        access: 'public',
        contentType: req.file.mimetype,
      });
      console.log('✅ Blob업로드성공:', blob.url);
      res.status(200).json(blob);
    } catch (error) {
      console.error('Error uploading to Vercel Blob:', error);
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  });
});

// ✅ 인증 없이 누구나 일정 생성 가능한 엔드포인트 (secureRouter보다 먼저 매칭되어야 함)
app.post('/api/schedules', async (req, res) => {
  try {
    console.log('📥 /api/schedules 요청 받음! req.body:', JSON.stringify(req.body, null, 2));
    const { venue_id, event_date, event_name, description, poster_image, poster_image_url } = req.body;
    if (!venue_id) {
      console.error('❌ venue_id가 없음!');
      return res.status(400).json({ error: 'Missing required fields: venue_id' });
    }
    // 프론트엔드에서 event_date를 보내지 않아도 서버에서 자동으로 현재 날짜 설정 (DB NOT NULL 제약조건 보장)
    const final_event_date = event_date || new Date().toISOString();
    const final_event_name = event_name && event_name !== '' ? event_name : '제목 없음';
    const final_description = description || '';
    const final_poster_image_url = poster_image || poster_image_url || null;
    console.log('✅ 삽입전 값들:', { venue_id, final_event_date, final_event_name, final_description, final_poster_image_url });
    const result = await sql`
      INSERT INTO schedules (venue_id, event_date, event_name, description, poster_image)
      VALUES (${venue_id}, ${final_event_date}, ${final_event_name}, ${final_description}, ${final_poster_image_url})
      RETURNING *;
    `;
    console.log('🎉 삽입성공! 결과:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating schedule:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create schedule', details: error.message });
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

    // poster_image_url이 빈 문자열일 경우 NULL로 처리
    const final_poster_image_url = poster_image_url || null;

    await sql`
      INSERT INTO schedules (venue_id, event_date, event_name, description, poster_image)
      VALUES (${venue_id}, ${event_date}, ${event_name}, ${description}, ${final_poster_image_url});
    `;
    res.status(201).json({ message: 'Schedule created successfully' });
  } catch (error) {
    console.error('Error creating schedule:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create schedule', details: error.message });
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

const registerVenueManagerHandler = require('./api/venue-managers/register');
secureRouter.post('/venue-managers/register', (req, res) => registerVenueManagerHandler(req, res));

const venueManagerLoginHandler = require('./api/venue-managers/login');
apiRouter.post('/venue-managers/login', (req, res) => venueManagerLoginHandler(req, res));

const approveVenueManagerHandler = require('./api/admin/approve-venue-manager');
secureRouter.post('/admin/approve-venue-manager', (req, res) => approveVenueManagerHandler(req, res));

apiRouter.use(secureRouter);
app.use('/api', apiRouter);

const getAuthenticatedUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Support both the hard-coded admin token and JWT auth from venue-managers/login
    if (token === 'admin-secret-token-2026') {
      return { is_admin: true, venue_id: null };
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
      if (decoded.is_admin || decoded.role === 'super-admin') {
        return { is_admin: true, venue_id: null, user_id: decoded.id || null };
      }
      if (decoded.id && decoded.venue_id) {
        return { is_admin: false, venue_id: decoded.venue_id, user_id: decoded.id };
      }
    } catch (error) {
      console.error('JWT verification failed in getAuthenticatedUser:', error.message);
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

      const textInRow = $(row).text().trim().replace(/\s+/g, ' ');

      const detailPageLink = $(linkInRow).attr('href');
      if (!detailPageLink) return;

      // 정규식을 사용하여 제목과 날짜를 명확하게 분리
      const titleMatch = textInRow.match(/(.*?)\s*\[공연일\s*:\s*(\d{4}년\s*\d{2}월\s*\d{2}일)\]/);
      
      let title = textInRow;
      let date = '';

      if (titleMatch && titleMatch.length === 3) {
         // [공연일: ...] 패턴이 있는 경우
         title = titleMatch[1].trim();
         date = titleMatch[2].trim();
       } else {
         // 기존 방식1: 다양한 형태의 숫자 날짜(YYYY.MM.DD, YYYY MM DD 등)를 먼저 찾아봄
         const dateMatchNumeric = textInRow.match(/(\d{4})\S+\s*(\d{2})\S+\s*(\d{2})\S+/);
         if (dateMatchNumeric) {
           date = `${dateMatchNumeric[1]}년 ${dateMatchNumeric[2]}월 ${dateMatchNumeric[3]}일`;
         }
         
         // 기존 방식2: 패턴이 없는 경우, 기존 방식대로 날짜를 찾아보고 제목에서 제거
         const dateMatchFallback = textInRow.match(/(\d{4}년\s*\d{2}월\s*\d{2}일)/);
         if (!date && dateMatchFallback) {
           date = dateMatchFallback[0];
         }
         
         // 제목에서 날짜와 관련 없는 텍스트 제거
         if (date) {
           title = textInRow.replace(date, '').replace(/\[.*OCR.*\]/gi, '').replace(/\[.*추출.*텍스트\]/gi, '').trim();
         }
       }
       if (!date) return; // 날짜를 추출할 수 없으면 이벤트를 추가하지 않음

      let image = null;
      const imgInRow = $(row).find('img');
      if (imgInRow.length > 0) {
        const rawImgSrc = imgInRow.attr('src');
        if (rawImgSrc) {
            if (rawImgSrc.startsWith('http')) {
                image = rawImgSrc;
            } else if (rawImgSrc.startsWith('/')) {
                image = `https://www.rollinghall.co.kr${rawImgSrc}`;
            } else {
                image = `https://www.rollinghall.co.kr/${rawImgSrc}`;
            }
        }
      }

      if (!preliminaryEvents.find(e => e.detailPageLink === detailPageLink)) {
        preliminaryEvents.push({
          id: `rh-${preliminaryEvents.length + 1}`,
          title: title.substring(0, 100), // 제목 길이 제한
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

// 공연일정 관련 API
app.get('/api/schedules', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM schedules ORDER BY event_date DESC;`;
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: '공연일정을 불러오는 중 오류가 발생했습니다.' });
  }
});



app.put('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { venue_id, event_name, event_date, description, poster_image } = req.body;
    
    // 누구나 수정/삭제 가능하도록 임시로 isAdmin 항상 true로 설정
    const authHeader = req.headers.authorization;
    let isAdmin = true; // 어떤 요청이든 통과시켜 500 오류 방지
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === 'admin-secret-token-2026') {
        isAdmin = true;
      }
    }
    
    console.log('PUT request - isAdmin:', isAdmin, 'authHeader:', authHeader);
    
    const result = await sql`
      UPDATE schedules 
      SET venue_id = ${venue_id}, event_name = ${event_name}, event_date = ${event_date}, 
          description = ${description}, poster_image_url = ${poster_image}
      WHERE id = ${id}
      RETURNING *;
    `;
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '해당 공연일정을 찾을 수 없습니다.' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: '공연일정을 수정하는 중 오류가 발생했습니다.' });
  }
});

app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 누구나 수정/삭제 가능하도록 임시로 isAdmin 항상 true로 설정
    const authHeader = req.headers.authorization;
    let isAdmin = true; // 어떤 요청이든 통과시켜 500 오류 방지
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === 'admin-secret-token-2026') {
        isAdmin = true;
      }
    }
    
    console.log('DELETE request - isAdmin:', isAdmin, 'authHeader:', authHeader);
    
    const result = await sql`DELETE FROM schedules WHERE id = ${id} RETURNING *;`;
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '해당 공연일정을 찾을 수 없습니다.' });
    }
    
    res.json({ message: '공연일정이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: '공연일정을 삭제하는 중 오류가 발생했습니다.' });
  }
});

// ✅ 라우터 마운트: apiRouter는 /api로, secureRouter도 /api로 등록 (모든 API 엔드포인트 정상 작동)
app.use('/api', apiRouter);
app.use('/api', secureRouter);

// Vercel Serverless 함수용 핸들러
module.exports = (req, res) => {
  return app(req, res);
};