require('dotenv').config();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

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
    // EUC-KR 인코딩 처리를 위해 buffer로 응답을 받습니다.
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const html = iconv.decode(buffer, 'EUC-KR'); // EUC-KR로 디코딩
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

    // 첫 번째 이벤트 링크의 가장 가까운 <table> 부모 요소의 outerHTML을 디버그 메시지에 추가
    if (eventLinks.length > 0) {
        const firstLink = $(eventLinks[0]);
        const closestTable = firstLink.closest('table');
        if (closestTable.length > 0) {
            debugMessages.push(`Closest table outerHTML for first event link: ${closestTable.prop('outerHTML')}`);
        } else {
            debugMessages.push(`No closest table found for first event link.`);
        }
    }

    const events = [];
    // 모든 게시물 행을 찾아서 직접 처리합니다 (웹사이트 구조 변경에 맞춤)
    const allRows = $('tr');
    debugMessages.push(`Found ${allRows.length} total rows in the page.`);
    
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      // 제목 링크 찾기
      const linkElement = $(row).find('a[href*="com_board_basic=read_form"]');
      if (linkElement.length === 0) continue;
      
      // 링크에서 직접 제목 텍스트 추출 (span.gallery_title이 없어도 작동하도록)
      const title = linkElement.text().trim();
      if (!title) {
        debugMessages.push(`Skipping row ${i + 1} because title is empty.`);
        continue;
      }
      
      debugMessages.push(`Processing event ${events.length + 1}:`);
      debugMessages.push(`  Title: '${title}'`);
      
      const detailPageLink = linkElement.attr('href');
      const parentTr = $(row);
      
      // 제목 <tr> 바로 다음 <tr>에서 날짜 정보 찾기
      const dateTr = parentTr.next('tr');
      let date = '';
      if (dateTr.length > 0) {
        const dateText = dateTr.text();
        debugMessages.push(`  Date row text: '${dateText}'`);
        const dateMatch = dateText.match(/(\d{4})\S*\s*(\d{2})\S*\s*(\d{2})\S*/);
        if (dateMatch) {
          date = `${dateMatch[1]}년 ${dateMatch[2]}월 ${dateMatch[3]}일`;
        }
      }
      debugMessages.push(`  Extracted date: '${date}'`);
      
      // 이미지 찾기 - 같은 섹션의 모든 img 태그에서 찾기
      let image = null;
      const sectionTable = $(row).closest('table');
      if (sectionTable.length > 0) {
        const allImagesInTable = sectionTable.find('img');
        if (allImagesInTable.length > 0) {
          image = $(allImagesInTable[0]).attr('src');
          debugMessages.push(`  Found image: ${image}`);
        }
      }

      debugMessages.push(`  detailPageLink: ${detailPageLink}`);
      debugMessages.push(`  image: ${image}`);
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
            // 상세 페이지도 EUC-KR로 디코딩
            const detailArrayBuffer = await detailResponse.arrayBuffer();
            const detailBuffer = Buffer.from(detailArrayBuffer);
            const detailHtml = iconv.decode(detailBuffer, 'EUC-KR');
            const detail$ = cheerio.load(detailHtml);

            const melonTicketLink = detail$('a[href*="ticket.melon.com"]').attr('href');
            debugMessages.push(`  Extracted melonTicketLink: ${melonTicketLink}`);
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
                    debugMessages.push(`  Extracted ticketUrl from next td (a tag): ${ticketUrl}`);
                  } else {
                    // a 태그가 없으면 td의 텍스트를 직접 사용
                    ticketUrl = nextTd.text().trim();
                    debugMessages.push(`  Extracted ticketUrl from next td (text): ${ticketUrl}`);
                  }
                }
              }

              if (!ticketUrl) { // 여전히 ticketUrl이 없으면 fullDetailPageUrl로 폴백
                ticketUrl = fullDetailPageUrl;
                debugMessages.push(`  Falling back to fullDetailPageUrl for ticketUrl: ${ticketUrl}`);
              }
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

module.exports = async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }
  
  // Set CORS headers for all other requests
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'GET') {
    try {
      const result = await fetchRollingHallEvents();
      res.status(200).json(result);
    } catch (error) {
      console.error('Error in /api/rollinghall-events endpoint:', error);
      res.status(500).json({ events: [], error: 'Failed to fetch Rolling Hall events.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};