const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { MongoClient } = require('mongodb');

// 인터파크 티켓, 예스24 티켓, 인스타그램에서 공연일정 스크래핑
const TICKET_SITES = [
  {
    name: 'interpark',
    baseUrl: 'https://ticket.interpark.com/TPGoodsList.asp?Ca=Liv',
    selectors: {
      items: '.product_list',
      title: '.prd_info h4',
      venue: '.prd_info .date_place',
      date: '.prd_info .date',
      image: '.prd_img img',
      link: '.prd_info a'
    }
  },
  {
    name: 'yes24',
    baseUrl: 'https://ticket.yes24.com/NewGenre/GenreNew?Gcode=009006001',
    selectors: {
      items: '.list-wrap .list',
      title: '.info strong',
      venue: '.info .place',
      date: '.info .date',
      image: '.img img',
      link: '.info a'
    }
  }
];

// 인스타그램 공연장 계정 목록 (venues.json의 instagram 필드에서 가져옴)
const INSTAGRAM_VENUES = [
  { username: 'club_aor_hongdae', venue_id: 'clubaor-hongdae-001' },
  { username: 'woomuji.hongdae', venue_id: 'woomuji-hongdae-001' },
  { username: 'clubrealize.gwangalli', venue_id: 'clubrealize-gwangalli-busan-001' },
  { username: 'hq.gwangalli', venue_id: 'hq-gwangalli-busan-001' }
];

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI;

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 관리자 권한 확인 (간단한 토큰 검증)
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  if (authToken !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let browser = null;
  let client = null;
  
  try {
    // Puppeteer로 브라우저 실행
    const executablePath = await chrome.executablePath;
    browser = await puppeteer.launch({
      args: chrome.args,
      executablePath,
      headless: chrome.headless,
    });

    const allSchedules = [];

    // 1. 기존 티켓 사이트에서 스크래핑
    for (const site of TICKET_SITES) {
      const page = await browser.newPage();
      await page.goto(site.baseUrl, { waitUntil: 'networkidle2' });

      const siteSchedules = await page.evaluate((site) => {
        const items = Array.from(document.querySelectorAll(site.selectors.items));
        return items.map(item => {
          const title = item.querySelector(site.selectors.title)?.innerText?.trim() || '';
          const venueText = item.querySelector(site.selectors.venue)?.innerText?.trim() || '';
          const dateText = item.querySelector(site.selectors.date)?.innerText?.trim() || '';
          const imageUrl = item.querySelector(site.selectors.image)?.src || '';
          const link = item.querySelector(site.selectors.link)?.href || '';

          // venues.json의 venue_id 매칭 (공연장 이름으로 찾기)
          let venueId = null;
          if (venueText.includes('CLUBAOR') || venueText.includes('클럽에이오알')) venueId = 'clubaor-hongdae-001';
          if (venueText.includes('우무지') || venueText.includes('Woomuji')) venueId = 'woomuji-hongdae-001';
          if (venueText.includes('리얼라이즈') || venueText.includes('Club Realize')) venueId = 'clubrealize-gwangalli-busan-001';
          if (venueText.includes('HQ 광안리')) venueId = 'hq-gwangalli-busan-001';

          // 날짜를 ISO 형식으로 변환
          const parsedDate = new Date(dateText.includes('~') ? dateText.split('~')[0] : dateText);
          const eventDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

          return {
            id: `${site.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            venue_id: venueId,
            event_name: title,
            description: `스크래핑된 공연: ${venueText}`,
            event_date: eventDate.toISOString(),
            poster_image_url: imageUrl,
            ticket_url: link,
            source: site.name
          };
        }).filter(s => s.venue_id); // venue_id가 매칭된 것만 필터링
      }, site);

      allSchedules.push(...siteSchedules);
      await page.close();
    }

    // 2. 인스타그램 공연장 계정에서 게시물 스크래핑 (추가된 기능)
    const INSTAGRAM_USER = process.env.INSTAGRAM_USER;
    const INSTAGRAM_PASS = process.env.INSTAGRAM_PASS;
    
    if (INSTAGRAM_USER && INSTAGRAM_PASS) {
      // 인스타그램 로그인
      const loginPage = await browser.newPage();
      await loginPage.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
      
      // 로그인 정보 입력
      await loginPage.waitForSelector('input[name="username"]');
      await loginPage.type('input[name="username"]', INSTAGRAM_USER);
      await loginPage.type('input[name="password"]', INSTAGRAM_PASS);
      await loginPage.click('button[type="submit"]');
      await loginPage.waitForNavigation({ waitUntil: 'networkidle2' });
      console.log('✅ [Instagram] 로그인 완료');

      // 각 공연장 인스타그램 프로필에서 최신 게시물 스크래핑
      for (const venue of INSTAGRAM_VENUES) {
        const profilePage = await browser.newPage();
        await profilePage.goto(`https://www.instagram.com/${venue.username}/`, { waitUntil: 'networkidle2' });
        await profilePage.waitForSelector('article');

        // 최근 10개 게시물의 캡션과 이미지 추출
        const instagramSchedules = await profilePage.evaluate((venue) => {
          const posts = Array.from(document.querySelectorAll('article > div > div > a')).slice(0, 10);
          return posts.map(post => {
            const imageUrl = post.querySelector('img')?.src || '';
            const postLink = post.href;
            
            // 게시물 상세 페이지에서 캡션 추출 (새 페이지에서 읽어오기)
            // 간단히 캡션에서 공연일정 키워드 추출 (정규식)
            const caption = post.querySelector('img')?.alt || '';
            const dateMatch = caption.match(/(\d{4})[년.]?\s*(\d{1,2})[월.]?\s*(\d{1,2})[일]?/);
            const eventTitle = caption.split('\n')[0] || `Instagram 게시물 - ${venue.username}`;
            
            let eventDate = new Date();
            if (dateMatch) {
              eventDate = new Date(`${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`);
            }

            return {
              id: `instagram-${venue.username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              venue_id: venue.venue_id,
              event_name: eventTitle,
              description: `인스타그램 스크래핑: ${caption}`,
              event_date: eventDate.toISOString(),
              poster_image_url: imageUrl,
              ticket_url: postLink,
              source: 'instagram'
            };
          });
        }, venue);

        allSchedules.push(...instagramSchedules);
        await profilePage.close();
      }
      await loginPage.close();
      console.log('✅ [Instagram] 모든 공연장 게시물 스크래핑 완료');
    } else {
      console.log('⚠️ [Instagram] 환경변수에 INSTAGRAM_USER/INSTAGRAM_PASS가 설정되지 않아 스크래핑을 건너뜁니다.');
    }

    // MongoDB에 저장
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('barzidorock');
    const schedulesCollection = db.collection('schedules');

    // 기존 스크래핑 데이터 삭제 후 새 데이터 저장 (중복 방지)
    await schedulesCollection.deleteMany({ source: { $in: ['interpark', 'yes24'] } });
    if (allSchedules.length > 0) {
      await schedulesCollection.insertMany(allSchedules);
    }

    await browser.close();
    await client.close();

    res.status(200).json({ 
      success: true, 
      scrapedCount: allSchedules.length,
      schedules: allSchedules 
    });

  } catch (error) {
    console.error('Error scraping schedules:', error);
    if (browser) await browser.close();
    if (client) await client.close();
    res.status(500).json({ error: 'Failed to scrape schedules', details: error.message });
  }
};