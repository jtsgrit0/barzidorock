require('dotenv').config(); // .env 파일 로드
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // node-fetch 임포트
const cheerio = require('cheerio'); // cheerio 임포트
const iconv = require('iconv-lite'); // iconv-lite 임포트

const app = express();
const PORT = process.env.PORT || 5000;

// 스크래핑 데이터 캐싱 설정 (1시간 = 3600000ms)
let cachedEvents = null;
let lastFetchedTime = 0;
const CACHE_DURATION = 3600000; // 1시간

// CORS 설정
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000', 'https://jtsgrit0.github.io', 'https://barzidorock.vercel.app', 'https://barzidorock-fe0wla9u3-jtsgrit0s-projects.vercel.app'];
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
      const errorMsg = `Failed to fetch main page: ${response.status} ${response.statusText}`;
      // console.error(errorMsg); // 에러 로깅은 유지
    }
    // EUC-KR 인코딩 처리를 위해 buffer로 응답을 받습니다.
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const html = iconv.decode(buffer, 'EUC-KR'); // EUC-KR로 디코딩
    const $ = cheerio.load(html);

    // const htmlLength = html.length; // debugMessages 제거
    // const htmlSnippet = html.substring(0, 200); // debugMessages 제거
    // const htmlTagCount = $('html').length; // debugMessages 제거
    // const bodyTagCount = $('body').length; // debugMessages 제거

    // const allHrefs = []; // debugMessages 제거
    // $('a').each((i, el) => { // debugMessages 제거
    //   const href = $(el).attr('href'); // debugMessages 제거
    //   if (href) { // debugMessages 제거
    //     allHrefs.push(href); // debugMessages 제거
    //   } // debugMessages 제거
    // }); // debugMessages 제거

    // 첫 번째 이벤트 링크의 가장 가까운 <table> 부모 요소의 outerHTML을 디버그 메시지에 추가 // debugMessages 제거

    const events = [];
    const eventLinks = $('td.body_text_eng a'); // 이벤트 링크 선택자를 정확히 지정

    for (let i = 0; i < eventLinks.length; i++) {
      const linkElement = eventLinks[i];
      const titleSpan = $(linkElement).find('span.gallery_title');

      // span.gallery_title이 없는 링크는 건너뜁니다.
      if (titleSpan.length === 0) {
        // console.log(`Skipping link ${i} due to missing title span.`); // 필요시 로깅
        continue;
      }

      const title = titleSpan.text().trim();
      const detailPageLink = $(linkElement).attr('href');

      // <a> 태그의 가장 가까운 <tr> 부모 요소를 찾고, 그 안에서 "공연일" 텍스트를 포함하는 <p> 태그를 찾습니다.
      const parentTr = $(linkElement).closest('tr');
      // debugMessages.push(`  Parent TR outerHTML: ${parentTr.prop('outerHTML')}`); // debugMessages 제거

      // 제목 <tr> 바로 다음 <tr>에 날짜 정보가 있는지 확인
      const dateTr = parentTr.next('tr');
      const dateTd = dateTr.find('td.gallery_etc');
      // debugMessages.push(`  Date TR outerHTML: ${dateTr.prop('outerHTML')}`); // debugMessages 제거
      // debugMessages.push(`  Date TD outerHTML: ${dateTd.prop('outerHTML')}`); // debugMessages 제거

      let date = '';
      if (dateTd.length > 0) {
        const dateText = dateTd.text();
        // debugMessages.push(`  Date TD text (raw): '${dateText}'`); // 원본 텍스트 디버그 // debugMessages 제거
        // 깨진 한글 문자 대신 숫자 패턴에 집중하여 날짜를 추출
        const dateMatch = dateText.match(/(\d{4})\S+\s*(\d{2})\S+\s*(\d{2})\S+/);
        // debugMessages.push(`  Date regex match result: ${JSON.stringify(dateMatch)}`); // 정규식 매칭 결과 디버그 // debugMessages 제거
        if (dateMatch) {
          // 추출된 연, 월, 일을 사용하여 날짜 문자열 재구성
          date = `${dateMatch[1]}년 ${dateMatch[2]}월 ${dateMatch[3]}일`;
        }
        // debugMessages.push(`  Final extracted date: '${date}'`); // 최종 추출된 날짜 디버그 // debugMessages 제거
      }

      // 이미지 정보 추출
      // linkElement는 제목 <a> 태그입니다.
      // 이미지 <img> 태그는 제목 <a> 태그와 다른 <tr>에 있습니다.
      // 제목 <a> 태그에서 가장 가까운 <table> 부모 요소를 찾습니다.
      const eventTable = $(linkElement).closest('table');
      // debugMessages.push(`  eventTable outerHTML: ${eventTable.prop('outerHTML')}`); // debugMessages 제거
      let image = null;
      if (eventTable.length > 0) {
        // 해당 테이블 내에서 이미지 <img> 태그를 찾습니다.
        // 이미지는 <td valign="bottom" align="center"> 안에 있습니다.
        const imageElement = eventTable.find('td[valign="bottom"][align="center"] img');
        // debugMessages.push(`  imageElement outerHTML: ${imageElement.prop('outerHTML')}`); // debugMessages 제거
        if (imageElement.length > 0) {
          image = imageElement.attr('src');
        }
      }

      // debugMessages.push(`  detailPageLink: ${detailPageLink}`); // debugMessages 제거
      // debugMessages.push(`  image: ${image}`); // debugMessages 제거
      // debugMessages.push(`  title: ${title}`); // debugMessages 제거
      // debugMessages.push(`  date: ${date}`); // debugMessages 제거

      if (detailPageLink && title && date) {
        const fullDetailPageUrl = `https://www.rollinghall.co.kr${detailPageLink}`;
        let ticketUrl = '';
        // debugMessages.push(`  Fetching detail page: ${fullDetailPageUrl}`); // Log 3 // debugMessages 제거

        try {
          const detailResponse = await fetch(fullDetailPageUrl);
          if (!detailResponse.ok) {
            const detailErrorMsg = `Failed to fetch detail page ${fullDetailPageUrl}: ${detailResponse.status} ${detailResponse.statusText}`;
            // debugMessages.push(detailErrorMsg); // debugMessages 제거
            // Continue to next event, but log the error
          } else {
            // 상세 페이지도 EUC-KR로 디코딩
            const detailArrayBuffer = await detailResponse.arrayBuffer();
            const detailBuffer = Buffer.from(detailArrayBuffer);
            const detailHtml = iconv.decode(detailBuffer, 'EUC-KR');
            const detail$ = cheerio.load(detailHtml);

            const melonTicketLink = detail$('a[href*="ticket.melon.com"]').attr('href');
            // debugMessages.push(`  Extracted melonTicketLink: ${melonTicketLink}`); // debugMessages 제거
            if (melonTicketLink) {
              ticketUrl = melonTicketLink;
            } else {
              // "예매하기" 텍스트를 포함하는 td를 찾고, 그 다음 td에서 링크를 추출
              const ticketTd = detail$('td:contains("예매하기")');
              if (ticketTd.length > 0) {
                const nextTd = ticketTd.next('td');
                if (nextTd.length > 0) {
                  const linkInNextTd = nextTd.find('a').attr('href');
                  if (linkInNextTd) {
                    ticketUrl = linkInNextTd;
                    // debugMessages.push(`  Extracted ticketUrl from next td (a tag): ${ticketUrl}`); // debugMessages 제거
                  } else {
                    // a 태그가 없으면 td의 텍스트를 직접 사용
                    ticketUrl = nextTd.text().trim();
                    // debugMessages.push(`  Extracted ticketUrl from next td (text): ${ticketUrl}`); // debugMessages 제거
                  }
                }
              }

              if (!ticketUrl) { // 여전히 ticketUrl이 없으면 fullDetailPageUrl로 폴백
                ticketUrl = fullDetailPageUrl;
                // debugMessages.push(`  Falling back to fullDetailPageUrl for ticketUrl: ${ticketUrl}`); // debugMessages 제거
              }
            }
          }
        } catch (detailError) {
          const detailErrorMsg = `Error fetching or parsing detail page for ${fullDetailPageUrl}: ${detailError.message}`;
          // debugMessages.push(detailErrorMsg); // debugMessages 제거
        }

        events.push({
          id: `rh-${i + 1}`,
          title: title,
          date: date,
          ticketUrl: ticketUrl,
          image: image ? `https://www.rollinghall.co.kr${image}` : 'https://picsum.photos/400/300?random=' + (i + 1)
        });
      } else {
        // debugMessages.push(`  Skipping event ${i + 1} due to missing detailPageLink, title, or date. (title: '${title}', detailPageLink: '${detailPageLink}', date: '${date}')`); // Log 5 // debugMessages 제거
      }
    }
    // debugMessages.push(`Finished scraping. Total events found: ${events.length}`); // Log 6 // debugMessages 제거
    return { events: events /*, debug: debugMessages.join('\n')*/ }; // debugMessages 제거
  } catch (error) {
    const errorMsg = `Error in fetchRollingHallEvents: ${error.message}`;
    // debugMessages.push(errorMsg); // debugMessages 제거
    console.error('Error in fetchRollingHallEvents:', errorMsg); // 에러 로깅은 유지
    return { events: [], error: errorMsg /*, debug: debugMessages.join('\n')*/ }; // debugMessages 제거
  }
}

// 롤링홀 공연 정보를 제공하는 API 엔드포인트 (1시간 캐싱 적용)
app.get('/api/rollinghall-events', async (req, res) => {
  const now = Date.now();
  
  // 캐시가 유효하면 캐시된 데이터 반환
  if (cachedEvents && (now - lastFetchedTime < CACHE_DURATION)) {
    return res.json({ events: cachedEvents, cached: true, lastFetched: new Date(lastFetchedTime).toISOString() });
  }

  // 캐시가 만료되었거나 없으면 새로 스크래핑
  try {
    const result = await fetchRollingHallEvents();
    // 새로 가져온 데이터 캐싱
    cachedEvents = result.events;
    lastFetchedTime = now;
    res.json({ ...result, cached: false, lastFetched: new Date(lastFetchedTime).toISOString() });
  } catch (error) {
    console.error('Error in /api/rollinghall-events endpoint:', error);
    // 스크래핑에 실패해도 캐시된 데이터가 있다면 반환
    if (cachedEvents) {
      return res.json({ events: cachedEvents, cached: true, lastFetched: new Date(lastFetchedTime).toISOString(), error: 'Failed to fetch fresh data, returning cached data.' });
    }
    res.status(500).json({ events: [], error: 'Failed to fetch Rolling Hall events.' });
  }
});

// 비밀번호 재설정 요청 엔드포인트 (forgot-password)
const forgotPasswordHandler = require('./api/auth/forgot-password');
app.post('/api/auth/forgot-password', (req, res) => forgotPasswordHandler(req, res));

// 비밀번호 재설정 엔드포인트 (reset-password)
const resetPasswordHandler = require('./api/auth/reset-password');
app.post('/api/auth/reset-password', (req, res) => resetPasswordHandler(req, res));

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Barzidorock Backend API is running!');
});

// 서버 시작
app.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`); // Removed for production
});