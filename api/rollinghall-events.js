const cheerio = require('cheerio');
const iconv = require('iconv-lite');

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
      }
      preliminaryEvents.push({ title, date, detailLink: detailPageLink });
    });

    debugMessages.push(`Found ${preliminaryEvents.length} preliminary events.`);

    const processedEvents = [];
    for (const event of preliminaryEvents) {
      let isoDate = null;
      if (event.date) {
        const koreanDateMatch = event.date.match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일/);
        if (koreanDateMatch) {
          isoDate = `${koreanDateMatch[1]}-${koreanDateMatch[2]}-${koreanDateMatch[3]}T00:00:00.000Z`;
        }
      }
      processedEvents.push({
        title: event.title,
        date: event.date,
        iso_date: isoDate,
        detail_link: event.detailLink
      });
    }

    return { events: processedEvents, debug: debugMessages.join('\n') };
  } catch (error) {
    debugMessages.push(`Exception in fetchRollingHallEvents: ${error.message}`);
    return { events: [], error: error.message, debug: debugMessages.join('\n') };
  }
}

module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed');
  }

  try {
    const result = await fetchRollingHallEvents();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /api/rollinghall-events endpoint:', error);
    res.status(500).json({ events: [], error: 'Failed to fetch Rolling Hall events.', debug: `Caught error in endpoint: ${error.message}` });
  }
};