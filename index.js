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
  const debugMessages = []; // 디버그 메시지를 수집할 배열

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorMsg = `Failed to fetch main page: ${response.status} ${response.statusText}`;
      debugMessages.push(errorMsg);
      return { events: [], error: errorMsg, debug: debugMessages.join('\n') };
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    const htmlLength = html.length;
    const htmlSnippet = html.substring(0, 200);
    const htmlTagCount = $('html').length;
    const bodyTagCount = $('body').length;
    debugMessages.push(`HTML Length: ${htmlLength}`);
    debugMessages.push(`HTML Snippet: ${htmlSnippet}`);
    debugMessages.push(`<html> count: ${htmlTagCount}`);
    debugMessages.push(`<body> count: ${bodyTagCount}`);

    const allHrefs = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        allHrefs.push(href);
      }
    });
    debugMessages.push(`All hrefs found: ${allHrefs.join(', ')}`);

    const eventLinks = $('a[href*="com_board_basic=read_form"]');
    debugMessages.push(`Found ${eventLinks.length} potential event links using general selector.`);

    const events = [];
    for (let i = 0; i < eventLinks.length; i++) {
      const linkElement = eventLinks[i];
      const titleSpan = $(linkElement).find('span.gallery_title');

      // span.gallery_title이 없는 링크는 건너뜁니다.
      if (titleSpan.length === 0) {
        debugMessages.push(`Skipping link ${i + 1} because it does not contain span.gallery_title.`);
        continue;
      }

      debugMessages.push(`Processing event ${i + 1}:`);
      debugMessages.push(`  Link outerHTML: ${$(linkElement).prop('outerHTML')}`);
      debugMessages.push(`  Parent outerHTML: ${$(linkElement).parent().prop('outerHTML')}`);

      const title = titleSpan.text().trim();
      const detailPageLink = $(linkElement).attr('href');

      // 날짜는 <a> 태그의 직계 형제 <p> 태그에서 "공연일" 텍스트를 포함하는 요소를 추출합니다.
      const dateElement = $(linkElement).siblings('p:contains("공연일")');
      debugMessages.push(`  Date element outerHTML: ${dateElement.prop('outerHTML')}`);
      let date = '';
      if (dateElement.length > 0 && dateElement.text().includes('공연일')) {
        date = dateElement.text().replace('[공연일 : ', '').replace(']', '').trim();
      }

      // 이미지 정보는 메인 페이지에서 직접적으로 보이지 않으므로, 일단 플레이스홀더를 사용합니다.
      const image = null; // Placeholder for now

      debugMessages.push(`  detailPageLink: ${detailPageLink}`);
      debugMessages.push(`  image: ${image}`); // Will be null for now
      debugMessages.push(`  title: ${title}`);
      debugMessages.push(`  date: ${date}`);

      if (detailPageLink && title && date) {
        const fullDetailPageUrl = `https://www.rollinghall.co.kr${detailPageLink}`;
        let ticketUrl = '';
        debugMessages.push(`  Fetching detail page: ${fullDetailPageUrl}`); // Log 3

        try {
          const detailResponse = await fetch(fullDetailPageUrl);
          if (!detailResponse.ok) {
            const detailErrorMsg = `Failed to fetch detail page ${fullDetailPageUrl}: ${detailResponse.status} ${detailResponse.statusText}`;
            debugMessages.push(detailErrorMsg);
            // Continue to next event, but log the error
          } else {
            const detailHtml = await detailResponse.text();
            const detail$ = cheerio.load(detailHtml);

            const melonTicketLink = detail$('a[href*="ticket.melon.com"]').attr('href');
            debugMessages.push(`  Extracted melonTicketLink: ${melonTicketLink}`); // Log 4
            if (melonTicketLink) {
              ticketUrl = melonTicketLink;
            }
          }
        } catch (detailError) {
          const detailErrorMsg = `Error fetching or parsing detail page for ${fullDetailPageUrl}: ${detailError.message}`;
          debugMessages.push(detailErrorMsg);
        }

        events.push({
          id: `rh-${i + 1}`,
          title: title,
          date: date,
          ticketUrl: ticketUrl,
          image: image ? `https://www.rollinghall.co.kr${image}` : 'https://picsum.photos/400/300?random=' + (i + 1)
        });
      } else {
        debugMessages.push(`  Skipping event ${i + 1} due to missing detailPageLink, title, or date. (title: '${title}', detailPageLink: '${detailPageLink}', date: '${date}')`); // Log 5
      }
    }
    debugMessages.push(`Finished scraping. Total events found: ${events.length}`); // Log 6
    return { events: events, debug: debugMessages.join('\n') };
  } catch (error) {
    const errorMsg = `Error in fetchRollingHallEvents: ${error.message}`;
    debugMessages.push(errorMsg);
    return { events: [], error: errorMsg, debug: debugMessages.join('\n') };
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