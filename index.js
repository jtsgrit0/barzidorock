require('dotenv').config(); // .env 파일 로드
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // node-fetch 임포트
const cheerio = require('cheerio'); // cheerio 임포트

const app = express();
const PORT = process.env.PORT || 5000;

// CORS 설정
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000', 'https://jtsgrit0.github.io'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON 요청 본문 파싱
app.use(express.json());

// 롤링홀 공연 정보를 스크래핑하는 함수
async function fetchRollingHallEvents() {
  const url = 'https://www.rollinghall.co.kr/default/mp3/mp3_sub2.php?sub=02';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch main page: ${response.status} ${response.statusText}`);
      return { events: [], error: `Failed to fetch main page: ${response.status} ${response.statusText}` };
    }
    const html = await response.text();
            const $ = cheerio.load(html);

            const htmlLength = html.length;
            const htmlSnippet = html.substring(0, 200);
            const htmlTagCount = $('html').length;
            const bodyTagCount = $('body').length;

            const allHrefs = [];
            $('a').each((i, el) => {
              const href = $(el).attr('href');
              if (href) {
                allHrefs.push(href);
              }
            });

            const events = [];
            // 새로운 셀렉터: 상세 페이지 링크를 포함하는 모든 <a> 태그를 찾습니다.
            const eventLinks = $('a[href*="com_board_basic=read_form"]');
            console.log(`Found ${eventLinks.length} potential event links using specific selector.`); // Log 1

            if (eventLinks.length === 0) {
              return { events: [], debug: `HTML Length: ${htmlLength}, HTML Snippet: ${htmlSnippet}, <html> count: ${htmlTagCount}, <body> count: ${bodyTagCount}, No event links with 'com_board_basic=read_form' found on the main page. All hrefs found: ${allHrefs.join(', ')}` };
            }

    for (let i = 0; i < eventLinks.length; i++) {
      const linkElement = eventLinks[i];
      const title = $(linkElement).text().trim();
      const detailPageLink = $(linkElement).attr('href');

      // 날짜는 <a> 태그의 다음 형제 <p> 태그에서 추출합니다.
      const dateElement = $(linkElement).next('p');
      let date = '';
      if (dateElement.length > 0 && dateElement.text().includes('공연일')) {
        date = dateElement.text().replace('[공연일 : ', '').replace(']', '').trim();
      }

      // 이미지 정보는 메인 페이지에서 직접적으로 보이지 않으므로, 일단 플레이스홀더를 사용합니다.
      const image = null; // Placeholder for now

      console.log(`Processing event ${i + 1}:`); // Log 2
      console.log(`  detailPageLink: ${detailPageLink}`);
      console.log(`  image: ${image}`); // Will be null for now
      console.log(`  title: ${title}`);
      console.log(`  date: ${date}`);

      if (detailPageLink && title && date) {
        const fullDetailPageUrl = `https://www.rollinghall.co.kr${detailPageLink}`;
        let ticketUrl = '';
        console.log(`  Fetching detail page: ${fullDetailPageUrl}`); // Log 3

        try {
          const detailResponse = await fetch(fullDetailPageUrl);
          if (!detailResponse.ok) {
            console.error(`Failed to fetch detail page ${fullDetailPageUrl}: ${detailResponse.status} ${detailResponse.statusText}`);
            // Continue to next event, but log the error
          } else {
            const detailHtml = await detailResponse.text();
            const detail$ = cheerio.load(detailHtml);

            const melonTicketLink = detail$('a[href*="ticket.melon.com"]').attr('href');
            console.log(`  Extracted melonTicketLink: ${melonTicketLink}`); // Log 4
            if (melonTicketLink) {
              ticketUrl = melonTicketLink;
            }
          }
        } catch (detailError) {
          console.error(`Error fetching or parsing detail page for ${fullDetailPageUrl}:`, detailError);
        }

        events.push({
          id: `rh-${i + 1}`,
          title: title,
          date: date,
          ticketUrl: ticketUrl,
          image: image ? `https://www.rollinghall.co.kr${image}` : 'https://picsum.photos/400/300?random=' + (i + 1)
        });
      } else {
        console.log(`  Skipping event ${i + 1} due to missing detailPageLink, title, or date.`); // Log 5
      }
    }
    console.log(`Finished scraping. Total events found: ${events.length}`); // Log 6
    return { events: events, debug: `Scraped ${events.length} events.` };
  } catch (error) {
    console.error('Error in fetchRollingHallEvents:', error);
    return { events: [], error: `Error during scraping: ${error.message}` };
  }
}

// 롤링홀 공연 정보를 제공하는 API 엔드포인트
app.get('/api/rollinghall-events', async (req, res) => {
  try {
    const result = await fetchRollingHallEvents();
    res.json(result);
  } catch (error) {
    console.error('Error in /api/rollinghall-events endpoint:', error);
    res.status(500).json({ events: [], error: 'Failed to fetch Rolling Hall events.' });
  }
});

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Barzidorock Backend API is running!');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});