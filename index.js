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
    const html = await response.text();
    const $ = cheerio.load(html);

    const events = [];
    // 스크린샷을 기반으로 각 공연 블록의 셀렉터를 추정합니다.
    // 'mp3_list_box' 클래스를 가진 div가 각 공연 정보를 담고 있는 것으로 보입니다.
    const eventElements = $('.mp3_list_box');

    for (let i = 0; i < eventElements.length; i++) {
      const element = eventElements[i];
      const detailPageLink = $(element).find('a').attr('href');
      const image = $(element).find('img').attr('src');
      // 제목과 날짜는 <a> 태그 내의 <p> 태그에 있을 것으로 추정합니다.
      const title = $(element).find('a p:nth-of-type(1)').text().trim();
      const date = $(element).find('a p:nth-of-type(2)').text().trim();

      if (detailPageLink && title && date) {
        const fullDetailPageUrl = `https://www.rollinghall.co.kr${detailPageLink}`;
        let ticketUrl = '';

        try {
          // 상세 페이지를 가져와서 예매 링크를 추출합니다.
          const detailResponse = await fetch(fullDetailPageUrl);
          const detailHtml = await detailResponse.text();
          const detail$ = cheerio.load(detailHtml);

          // 상세 페이지에서 'ticket.melon.com'을 포함하는 <a> 태그의 href를 찾습니다.
          const melonTicketLink = detail$('a[href*="ticket.melon.com"]').attr('href');
          if (melonTicketLink) {
            ticketUrl = melonTicketLink;
          }
        } catch (detailError) {
          console.error(`Error fetching detail page for ${fullDetailPageUrl}:`, detailError);
        }

        events.push({
          id: `rh-${i + 1}`,
          title: title,
          date: date,
          ticketUrl: ticketUrl,
          image: image ? `https://www.rollinghall.co.kr${image}` : 'https://picsum.photos/400/300?random=' + (i + 1)
        });
      }
    }
    return events;
  } catch (error) {
    console.error('Error fetching Rolling Hall events:', error);
    return [];
  }
}

// 롤링홀 공연 정보를 제공하는 API 엔드포인트
app.get('/api/rollinghall-events', async (req, res) => {
  const events = await fetchRollingHallEvents();
  res.json(events);
});

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Barzidorock Backend API is running!');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});