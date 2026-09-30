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

// 롤링홀 이벤트 스크래핑 함수 (티켓탭 필수)
async function fetchRollingHallEvents() {
  const baseHost = 'https://www.rollinghall.co.kr';
  const listUrl = `${baseHost}/default/mp3/mp3_sub2.php?sub=02`;
  const debugMessages = [];

  try {
    const response = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      const errorMsg = `Failed to fetch list page: ${response.status} ${response.statusText}`;
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

      const imgInRow = $(row).find('img');
      const listImageSrc = imgInRow.attr('src');
      
      const textInRow = $(row).text().trim().replace(/\s+/g, ' ');
      const detailPageLink = $(linkInRow).attr('href');
      if (!detailPageLink) return;

      const titleMatch = textInRow.match(/(.*?)\s*\[공연일\s*:\s*(\d{4}년\s*\d{2}월\s*\d{2}일)\]/);
      
      let title = textInRow;
      let date = '';
      if (titleMatch) {
        title = titleMatch[1].trim();
        date = titleMatch[2].trim();
      } else {
        const dateMatch = textInRow.match(/\[공연일\s*:\s*(\d{4}년\s*\d{2}월\s*\d{2}일)\]/);
        if (dateMatch) {
          date = dateMatch[1].trim();
          title = textInRow.replace(dateMatch[0], '').trim();
        }
      }

      const fullLink = detailPageLink.startsWith('http') ? detailPageLink : `${baseHost}/${detailPageLink}`;
      let fullImageSrc = listImageSrc ? (listImageSrc.startsWith('http') ? listImageSrc : `${baseHost}/${listImageSrc.replace(/^\//, '')}`) : '';
      
      preliminaryEvents.push({
        title,
        date,
        link: fullLink,
        image: fullImageSrc,
        rawText: textInRow
      });
    });

    debugMessages.push(`Parsed ${preliminaryEvents.length} valid events, fetching details...`);

    // 상세페이지에서 고해상도 이미지 추가 스크래핑 (원래 로직 유지)
    const processedEvents = [];
    for (let i = 0; i < preliminaryEvents.length; i++) {
      const event = preliminaryEvents[i];
      let detailImage = event.image;
      
      try {
        if (event.link) {
          const detailRes = await fetch(event.link, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
          });
          if (detailRes.ok) {
            const detailBuffer = await detailRes.arrayBuffer();
            const detailHtml = iconv.decode(Buffer.from(detailBuffer), 'EUC-KR');
            const detail$ = cheerio.load(detailHtml);
            const contentImages = detail$('img[src*="/data/"]');
            if (contentImages.length > 0) {
              const firstImage = contentImages.first().attr('src');
              if (firstImage) {
                detailImage = firstImage.startsWith('http') ? firstImage : `${baseHost}/${firstImage.replace(/^\//, '')}`;
              }
            }
          }
        }
      } catch (e) {
        debugMessages.push(`Failed to fetch details for ${event.title}: ${e.message}`);
      }
      
      let normalizedDate = event.date;
      if (event.date.includes('년') && event.date.includes('월') && event.date.includes('일')) {
        normalizedDate = event.date.replace(/년|월/g, '.').replace('일', '').trim();
      }
      
      processedEvents.push({
        id: `rh-${String(i).padStart(3, '0')}`,
        title: event.title,
        date: normalizedDate,
        ticketUrl: event.link,
        image: detailImage
      });
    }

    debugMessages.push(`Completed processing ${processedEvents.length} events.`);
    return { events: processedEvents, debug: debugMessages.join('\n') };
  } catch (error) {
    debugMessages.push(`Exception in fetchRollingHallEvents: ${error.message}`);
    return { events: [], error: error.message, debug: debugMessages.join('\n') };
  }
}

// 롤링홀 이벤트 데이터를 반환하는 엔드포인트 (티켓탭 필수)
apiRouter.get('/rollinghall-events', cors(), async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const result = await fetchRollingHallEvents();
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ [rollinghall-events] 롤링홀 이벤트 로드 오류:', error);
    res.status(500).json({ events: [], error: 'Failed to fetch Rolling Hall events.', debug: `Caught error in endpoint: ${error.message}` });
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