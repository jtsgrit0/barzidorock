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
    // 각 공연 정보를 담고 있는 테이블 행을 찾습니다.
    // 웹사이트 구조에 따라 셀렉터는 변경될 수 있습니다.
    $('.concert_list tbody tr').each((i, element) => {
      const title = $(element).find('td:nth-child(2) a').text().trim();
      const date = $(element).find('td:nth-child(3)').text().trim();
      const ticketUrl = $(element).find('td:nth-child(2) a').attr('href');
      const image = $(element).find('td:nth-child(1) img').attr('src'); // 이미지 URL 추출

      if (title && date && ticketUrl) {
        events.push({
          id: `rh-${i + 1}`,
          title: title,
          date: date,
          ticketUrl: `https://www.rollinghall.co.kr${ticketUrl}`, // 상대 경로를 절대 경로로 변환
          image: image ? `https://www.rollinghall.co.kr${image}` : 'https://picsum.photos/400/300?random=' + (i + 1) // 이미지 URL이 없으면 기본 이미지 사용
        });
      }
    });
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