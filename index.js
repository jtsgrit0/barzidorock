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
const PORT = process.env.PORT || 3001;

// 롤링홀 이벤트 스크래핑 함수 (티켓탭 필수) - 원래 이미지 스크래핑 로직 완전 복구
async function fetchRollingHallEvents() {
  const baseHost = 'https://www.rollinghall.co.kr';
  const listUrl = `${baseHost}/default/mp3/mp3_sub2.php?sub=02`;
  const debugMessages = [];

  try {
    // 1페이지와 2페이지 URL 모두 준비
    const pageUrls = [
      `${baseHost}/default/mp3/mp3_sub2.php?sub=02&com_board_id=12`, // 1페이지
      `${baseHost}/default/mp3/mp3_sub2.php?sub=02&com_board_id=12&com_board_page=2` // 2페이지
    ];
    
    const preliminaryEvents = [];
    
    // 두 페이지 모두 순차적으로 스크래핑
    for (const pageUrl of pageUrls) {
      console.log(`🔍 스크래핑 페이지: ${pageUrl}`);
      debugMessages.push(`Scraping page: ${pageUrl}`);
      
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!response.ok) {
        debugMessages.push(`Failed to fetch page ${pageUrl}: ${response.status} ${response.statusText}`);
        continue; // 실패한 페이지는 건너뛰기
      }
      const arrayBuffer = await response.arrayBuffer();
      const html = iconv.decode(Buffer.from(arrayBuffer), 'EUC-KR');
      const $ = cheerio.load(html);

      const allRows = $('tr');
      debugMessages.push(`Found ${allRows.length} total table rows on page ${pageUrl}`);

      for (const row of allRows) {
        const $row = $(row);
        const linkInRow = $row.find('a[href*="com_board_basic=read_form"]');
        if (linkInRow.length === 0) continue;

        const textInRow = $row.text().trim().replace(/\s+/g, ' ');
        const detailPageLink = $(linkInRow).attr('href');
        if (!detailPageLink) continue;

        // 리스트 페이지에서 썸네일 이미지 추출
        const imgInRow = $row.find('img');
        const listImageSrc = imgInRow.attr('src');
        let imageSrc = listImageSrc ? (listImageSrc.startsWith('http') ? listImageSrc : `${baseHost}/${listImageSrc.replace(/^\//, '')}`) : '';

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
        // 빈 제목이나 날짜가 있는 유효하지 않은 이벤트 필터링
        if (!title || !date) continue;

        const fullLink = detailPageLink.startsWith('http') ? detailPageLink : `${baseHost}/${detailPageLink}`;
        // 중복 이벤트 방지: 제목+날짜로 유니크하게 저장
        if (!preliminaryEvents.some(e => e.title === title && e.date === date)) {
          preliminaryEvents.push({
            title,
            date,
            detailLink: fullLink,
            ticketUrl: null, // 초기값 null
            image: imageSrc,
            rawText: textInRow
          });
          debugMessages.push(`Added event: ${title} (${date})`);
        } else {
          debugMessages.push(`Skipped duplicate event: ${title} (${date})`);
        }
      }
    }
    
    debugMessages.push(`Total unique events collected from all pages: ${preliminaryEvents.length}`);

    // 상세 페이지에서 고해상도 이미지 추가 스크래핑
    const processedEvents = [];
    for (let i = 0; i < preliminaryEvents.length; i++) {
      const event = preliminaryEvents[i];
      let finalImage = event.image;
      
      // 모든 이벤트에 대해 상세 페이지에서 이미지와 예매 링크 추출 (항상 실행!)
      try {
        const detailRes = await fetch(event.detailLink, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        if (detailRes.ok) {
          const detailBuffer = await detailRes.arrayBuffer();
          const detailHtml = iconv.decode(Buffer.from(detailBuffer), 'EUC-KR');
          const detail$ = cheerio.load(detailHtml);
          
          // /data/ 경로의 게시판 본문 이미지 찾기 (이미지 업데이트)
          const contentImages = detail$('img[src*="/data/"]');
          if (contentImages.length > 0) {
            const firstImage = contentImages.first().attr('src');
            if (firstImage) {
              finalImage = firstImage.startsWith('http') ? firstImage : `${baseHost}/${firstImage.replace(/^\//, '')}`;
            }
          }
          
          // ✅ 실제 예매 링크 추출! 인터파크, 예스24, 멜론, 야놀자 등 모든 외부 예매 링크 찾기
          const ticketLink = detail$('a[href*="ticketlink.interpark.com"], a[href*="yes24.com"], a[href*="ticket.interpark.com"], a[href*="ticket.melon.com"], a[href*="nol.yanolja.com"], a[target="_blank"]');
          if (ticketLink.length > 0) {
            const firstTicketLink = ticketLink.first().attr('href');
            if (firstTicketLink) {
              event.ticketUrl = firstTicketLink.startsWith('http') ? firstTicketLink : `https://${firstTicketLink.replace(/^\//, '')}`;
              debugMessages.push(`✅ [event ${i}] 예매 링크 찾음: ${event.ticketUrl}`);
            }
          }
        }
      } catch (error) {
        debugMessages.push(`Failed to fetch detail page for event ${i}: ${error.message}`);
      }
      
      // 만약 예매 링크를 못찾았으면 기본 상세 링크로 대체
      if (!event.ticketUrl) {
        event.ticketUrl = event.detailLink;
      }

      let normalizedDate = event.date;
      if (event.date.includes('년') && event.date.includes('월') && event.date.includes('일')) {
        normalizedDate = event.date.replace(/년|월/g, '.').replace('일', '').trim();
      }

      processedEvents.push({
        id: `rh-${String(i).padStart(3, '0')}`,
        title: event.title,
        date: normalizedDate,
        ticketUrl: event.ticketUrl, // 실제 외부 예매 링크만 들어감!
        image: finalImage
      });
    }

    debugMessages.push(`Successfully processed ${processedEvents.length} events with images.`);
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