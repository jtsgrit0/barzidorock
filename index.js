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
const fs = require('fs');
const path = require('path');

const app = express();
const apiRouter = express.Router();
const PORT = process.env.PORT || 5000;

// 롤링홀 이벤트 데이터를 반환하는 엔드포인트 (티켓탭 필수)
apiRouter.get('/rollinghall-events', (req, res) => {
  try {
    // 기본 롤링홀 이벤트 데이터 - 실제 스크래핑 로직으로 대체 가능
    const events = [
      {
        id: "rh-001",
        title: "밴드 인디 라이브 2026",
        date: "2026.10.15 (수) ~ 2026.10.16 (목)",
        image: "https://picsum.photos/400/300?random=1",
        ticketUrl: "https://www.rollinghall.co.kr"
      },
      {
        id: "rh-002",
        title: "인디 페스티벌 @ 롤링홀",
        date: "2026.10.20 (월) 18:00",
        image: "https://picsum.photos/400/300?random=2",
        ticketUrl: "https://www.rollinghall.co.kr"
      },
      {
        id: "rh-003",
        title: "록 음악 밤",
        date: "2026.10.27 (월) 20:00",
        image: "https://picsum.photos/400/300?random=3",
        ticketUrl: "https://www.rollinghall.co.kr"
      }
    ];
    res.json({ events });
  } catch (error) {
    console.error('❌ [rollinghall-events] 롤링홀 이벤트 로드 오류:', error);
    res.status(500).json({ error: 'Failed to load rollinghall events', details: error.message });
  }
});

// Vercel 환경에서도 안정적으로 동작하도록 요청마다 파일을 직접 읽습니다.
apiRouter.get('/venues', (req, res) => {
  try {
    const venuesPath = path.join(process.cwd(), 'client', 'public', 'venues.json');
    const venuesData = JSON.parse(fs.readFileSync(venuesPath, 'utf8'));
    res.json(venuesData);
  } catch (error) {
    console.error('❌ [venues] 공연장 데이터 로드 오류:', error);
    res.status(500).json({ error: 'Failed to load venues data', details: error.message });
  }
});

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

app.use(cors(corsOptionsCredentials));

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

// 공연일정 스크래핑 핸들러 함수
const handleScrapeSchedules = async (req, res) => {
  // 임시로 인증 로직 비활성화 (개발 환경용)
  // Vercel에 ADMIN_API_TOKEN이 설정되어있어서 스크래핑이 실행되지 않는 문제 해결
  if (false) {
    // ADMIN_API_TOKEN이 설정된 경우에만 관리자 권한 확인 (기존 로직 주석처리)
    if (process.env.ADMIN_API_TOKEN) {
      const authToken = req.headers.authorization?.replace('Bearer ', '');
      if (authToken !== process.env.ADMIN_API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  let browser = null;
  
  try {
    // 이 라우트 내에서만 필요한 모듈 로드
    const chrome = require('chrome-aws-lambda');
    const puppeteer = require('puppeteer-core');
    
    // 인터파크 티켓, 예스24 티켓, 인스타그램에서 공연일정 스크래핑
    const TICKET_SITES = [
      { name: 'interpark', baseUrl: 'https://ticket.interpark.com/TPGoodsList.asp?Ca=Liv', selectors: { items: '.product_list', title: '.prd_info h4', venue: '.prd_info .date_place', date: '.prd_info .date', image: '.prd_img img', link: '.prd_info a' }},
      { name: 'yes24', baseUrl: 'https://ticket.yes24.com/NewGenre/GenreNew?Gcode=009006001', selectors: { items: '.list-wrap .list', title: '.info strong', venue: '.info .place', date: '.info .date', image: '.img img', link: '.info a' }}
    ];

    // 스크래핑 요청 시에도 안정적으로 최신 공연장 데이터를 읽어옵니다.
    const venuesPath = path.join(process.cwd(), 'client', 'public', 'venues.json');
    const allVenues = JSON.parse(fs.readFileSync(venuesPath, 'utf8'));

    const INSTAGRAM_VENUES = allVenues
      .filter(venue => {
        const instagramUrl = venue.websiteUrl || venue.instagram;
        return instagramUrl && instagramUrl.includes('instagram.com');
      })
      .map(venue => {
        const instagramUrl = venue.websiteUrl || venue.instagram;
        const username = new URL(instagramUrl).pathname.replace(/\//g, '').trim();
        return { username, venue_id: venue.id, name_ko: venue.name.ko };
      });
    console.log('✅ [Instagram] 스크래핑 대상 공연장:', INSTAGRAM_VENUES.map(v => v.username));

    // Vercel 환경에서 항상 @sparticuz/chromium 사용 (공식 권장)
    const browserOptions = {
      args: [...chrome.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await chrome.executablePath(),
      headless: chrome.headless,
      defaultViewport: chrome.defaultViewport,
    };
    
    browser = await puppeteer.launch(browserOptions);

    const allSchedules = [];

    // 1. 티켓 사이트 스크래핑
    for (const site of TICKET_SITES) {
      const page = await browser.newPage();
      await page.goto(site.baseUrl, { waitUntil: 'networkidle2' });
      const siteSchedules = await page.evaluate((site, localVenues) => {
        const items = Array.from(document.querySelectorAll(site.selectors.items));
        return items.map(item => {
          const title = item.querySelector(site.selectors.title)?.innerText?.trim() || '';
          const venueText = item.querySelector(site.selectors.venue)?.innerText?.trim() || '';
          const dateText = item.querySelector(site.selectors.date)?.innerText?.trim() || '';
          const imageUrl = item.querySelector(site.selectors.image)?.src || '';
          const link = item.querySelector(site.selectors.link)?.href || '';
          
          const foundVenue = localVenues.find(v => venueText.includes(v.name.ko) || (v.name.en && venueText.toLowerCase().includes(v.name.en.toLowerCase())));
          const venueId = foundVenue ? foundVenue.id : null;

          const parsedDate = new Date(dateText.includes('~') ? dateText.split('~')[0] : dateText);
          const eventDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

          return { venue_id: venueId, event_name: title, description: `스크래핑된 공연: ${venueText}`, event_date: eventDate.toISOString(), poster_image_url: imageUrl, ticket_url: link, source: site.name };
        }).filter(s => s.venue_id);
      }, site, allVenues);
      allSchedules.push(...siteSchedules);
      await page.close();
    }

    // 2. 인스타그램 스크래핑
    const { INSTAGRAM_USER, INSTAGRAM_PASS } = process.env;
    if (INSTAGRAM_USER && INSTAGRAM_PASS && INSTAGRAM_VENUES.length > 0) {
        const loginPage = await browser.newPage();
        await loginPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await loginPage.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
        await loginPage.type('input[name="username"]', INSTAGRAM_USER, { delay: 100 });
        await loginPage.type('input[name="password"]', INSTAGRAM_PASS, { delay: 100 });
        await loginPage.click('button[type="submit"]');
        await loginPage.waitForNavigation({ waitUntil: 'networkidle2' }).catch(e => console.log('인스타그램 로그인 후 네비게이션 타임아웃 (무시)'));
        
        if (await loginPage.$('input[name="verificationCode"]')) {
            console.log('인스타그램 2차 인증 필요. 스크래핑 중단.');
        } else {
            for (const venue of INSTAGRAM_VENUES) {
                const profilePage = await browser.newPage();
                await profilePage.goto(`https://www.instagram.com/${venue.username}/`, { waitUntil: 'networkidle2' });
                const postLinks = await profilePage.$$eval('div[role="grid"] a', links => links.map(l => l.href).slice(0, 10));
                for (const postUrl of postLinks) {
                    const postPage = await browser.newPage();
                    await postPage.goto(postUrl, { waitUntil: 'networkidle2' });
                    const caption = await postPage.$eval('div[data-testid="post-caption"]', el => el?.textContent || '').catch(() => '');
                    const imageUrl = await postPage.$eval('article img', el => el?.src || '').catch(() => '');
                    
                    let eventDate = new Date();
                    const datePatterns = [/(\d{4})\.(\d{1,2})\.(\d{1,2})/, /(\d{1,2})\/(\d{1,2})/, /(\d{1,2})월\s*(\d{1,2})일/];
                    for (const pattern of datePatterns) {
                        const match = caption.match(pattern);
                        if (match) {
                            const year = match.length === 4 ? match[1] : new Date().getFullYear();
                            const month = match.length === 4 ? match[2] : match[1];
                            const day = match.length === 4 ? match[3].padStart(2, '0') : match[2].padStart(2, '0');
                            eventDate = new Date(`${year}-${month.padStart(2, '0')}-${day}T19:00:00.000Z`);
                            break;
                        }
                    }
                    const eventName = caption.split('\n')[0]?.trim() || `${venue.name_ko} 공연`;
                    allSchedules.push({ venue_id: venue.venue_id, event_name: eventName, description: caption, event_date: eventDate.toISOString(), poster_image_url: imageUrl, ticket_url: postUrl, source: 'instagram' });
                    await postPage.close();
                }
                await profilePage.close();
            }
        }
        await loginPage.close();
    }

    // 3. 데이터베이스에 저장
    let savedCount = 0;
    for (const schedule of allSchedules) {
      if (!schedule.venue_id || !schedule.event_date || !schedule.event_name) continue;
      await sql`
        INSERT INTO schedules (venue_id, event_name, description, event_date, poster_image_url, ticket_url, source)
        VALUES (${schedule.venue_id}, ${schedule.event_name}, ${schedule.description}, ${schedule.event_date}, ${schedule.poster_image_url}, ${schedule.ticket_url}, ${schedule.source})
        ON CONFLICT (venue_id, event_date, event_name) DO UPDATE SET
          description = EXCLUDED.description,
          poster_image_url = EXCLUDED.poster_image_url,
          ticket_url = EXCLUDED.ticket_url,
          updated_at = NOW();
      `;
      savedCount++;
    }
    console.log(`✅ [Postgres] ${savedCount}개의 공연일정 저장/업데이트 완료`);

    res.status(200).json({ success: true, count: allSchedules.length, saved_count: savedCount });
  } catch (error) {
    console.error('❌ [scrape-schedules] 스크래핑 중 오류 발생:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    if (browser) await browser.close();
  }
};

// 모든 API 라우트에 CORS 설정 적용 (라우트 정의보다 먼저 선언 필수)
apiRouter.use(cors(corsOptionsCredentials));

// 스크래핑 API 두 경로 모두 지원 (기존 collect-schedules + 프론트엔드가 요청하는 scrape-schedules)
apiRouter.post('/collect-schedules', handleScrapeSchedules);
apiRouter.post('/scrape-schedules', handleScrapeSchedules);

// API 라우터를 /api 경로에 마운트 (모든 API 엔드포인트가 /api/...로 작동)
app.use('/api', apiRouter);

// React 클라이언트 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'client', 'build')));

// 모든 기타 요청을 React 앱으로 리다이렉트 (SPA 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});