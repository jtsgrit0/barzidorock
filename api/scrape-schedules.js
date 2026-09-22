const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { MongoClient } = require('mongodb');

// 인터파크 티켓, 예스24 티켓 등에서 공연일정 스크래핑
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

    // 각 티켓 사이트에서 스크래핑
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
          const venueMatch = venueText.match(/(홍대|합정|연남|광안리|서교동).*$/);
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