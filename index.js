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

    const events = [];
    // 새로운 셀렉터: 상세 페이지 링크를 포함하는 모든 <a> 태그를 찾습니다.
    const eventLinks = $('a[href*="com_board_basic=read_form"]');
    console.log(`Found ${eventLinks.length} potential event links.`); // Log 1

    if (eventLinks.length === 0) {
      return { events: [], debug: "No event links with 'com_board_basic=read_form' found on the main page." };
    }

    for (let i = 0; i < eventLinks.length; i++) {
      const linkElement = eventLinks[i];
      const title = $(linkElement).text().trim();
      const detailPageLink = $(linkElement).attr('href');

      // 부모 요소를 찾아서 이미지와 날짜를 추출합니다.
      const parentElement = $(linkElement).parent();
      const image = parentElement.find('img').attr('src');
      const date = parentElement.find('p:contains("공연일")').text().trim(); // '공연일' 텍스트를 포함하는 p 태그

      console.log(`Processing event ${i + 1}:`); // Log 2
      console.log(`  detailPageLink: ${detailPageLink}`);
      console.log(`  image: ${image}`);
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