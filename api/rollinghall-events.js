const fetch = require('node-fetch');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method ' + req.method + ' Not Allowed');
  }

  const baseHost = 'https://www.rollinghall.co.kr';
  const debugMessages = [];
  const allEvents = [];
  const seenEvents = new Set(); // 중복 방지

  try {
    // 1페이지와 2페이지 URL 모두 준비
    const pageUrls = [
      baseHost + '/default/mp3/mp3_sub2.php?sub=02&com_board_id=12', // 1페이지
      baseHost + '/default/mp3/mp3_sub2.php?sub=02&com_board_id=12&com_board_page=2' // 2페이지
    ];
    
    // 모든 URL과 문자열에 포함된 백틱을 미리 제거하는 유틸리티 함수
    const cleanStr = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/`/g, '').trim();
    };
    
    // 두 페이지 모두 순차적으로 스크래핑
    for (const pageUrl of pageUrls) {
      console.log('🔍 스크래핑 페이지: ' + pageUrl);
      debugMessages.push('Scraping page: ' + cleanStr(pageUrl));
      
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!response.ok) {
        debugMessages.push('Failed to fetch page ' + pageUrl + ': ' + response.status + ' ' + response.statusText);
        continue; // 실패한 페이지는 건너뛰기
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const html = iconv.decode(buffer, 'EUC-KR');
      const $ = cheerio.load(html);

      // 공연 목록 아이템 찾기
      const listItems = $('.bg-white');
      console.log('✅ 페이지에서 ' + listItems.length + '개의 공연 찾음');
      debugMessages.push('Found ' + listItems.length + ' events on page');

      for (let i = 0; i < listItems.length; i++) {
        const el = listItems[i];
        const titleEl = $(el).find('h3, h4, .title a');
        const dateEl = $(el).find('.date, .period');
        const linkEl = $(el).find('a[href]');
        const imgEl = $(el).find('img[src]');

        const rawTitle = titleEl.text().trim() || 'Rolling Hall 공연';
        const title = rawTitle.normalize('NFC'); // 한글 정규화로 깨짐 방지
        const date = dateEl.text().trim() || '';
        const detailLink = linkEl.attr('href');
        const fullDetailLink = detailLink?.startsWith('http') ? detailLink : baseHost + '/' + detailLink?.replace(/^\//, '');
        let finalImage = cleanStr(imgEl.attr('src') || '');
        let ticketUrl = '';

        // 중복 이벤트 건너뛰기 (제목+날짜로 판단)
        const uniqueKey = (title + '-' + date).normalize('NFC');
        if (seenEvents.has(uniqueKey)) {
          debugMessages.push('⏭️ 중복 이벤트 건너뛰기: ' + title + ' (' + date + ')');
          continue;
        }
        seenEvents.add(uniqueKey);

        // 리스트 페이지에서 썸네일 이미지 가져오기
        if (finalImage && !finalImage.startsWith('http')) {
          finalImage = baseHost + '/' + finalImage.replace(/^\//, '');
        }
        // 이미지 URL에도 cleanStr 적용해서 절대 백틱 없애기
        finalImage = cleanStr(finalImage);

        // 모든 이벤트에 대해 상세 페이지에서 이미지와 예매 링크 추출 (항상 실행!)
        try {
          const detailRes = await fetch(fullDetailLink, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
          });
          if (detailRes.ok) {
            const detailBuffer = await detailRes.arrayBuffer();
            const detailHtml = iconv.decode(Buffer.from(detailBuffer), 'EUC-KR');
            const detail$ = cheerio.load(detailHtml);
            
            // /data/ 경로의 게시판 본문 이미지 찾기 (이미지 업데이트)
            const contentImages = detail$('img[src*="/data/"]');
            if (contentImages.length > 0) {
              const firstImage = contentImages.first().attr('src');
              if (firstImage) {
                finalImage = firstImage.startsWith('http') ? firstImage : baseHost + '/' + firstImage.replace(/^\//, '');
              }
            }
            
            // ✅ 실제 예매 링크 추출! 인터파크, 예스24, 멜론, 야놀자 등 모든 외부 예매 링크 찾기
            const ticketLink = detail$('a[href*="ticketlink.interpark.com"], a[href*="yes24.com"], a[href*="ticket.interpark.com"], a[href*="ticket.melon.com"], a[href*="nol.yanolja.com"], a[target="_blank"]');
            if (ticketLink.length > 0) {
              const firstTicketLink = ticketLink.first().attr('href');
              if (firstTicketLink) {
                ticketUrl = firstTicketLink.startsWith('http') ? firstTicketLink : 'https://' + firstTicketLink.replace(/^\//, '');
                debugMessages.push('✅ [event ' + i + '] 예매 링크 찾음: ' + ticketUrl);
              }
            }
          }
        } catch (error) {
          debugMessages.push('Failed to fetch detail page for event ' + i + ': ' + error.message);
        }

        // 클라이언트에 전송하기 전에 모든 URL 필드를 한 번 더 철저히 정리
        // 모든 필드에 cleanStr 적용해서 백틱 완전 제거
        const cleanImage = cleanStr(finalImage) || 'https://picsum.photos/400/300?random=' + (allEvents.length + 1);
        const cleanTicketUrl = cleanStr(ticketUrl) || 'https://www.rollinghall.co.kr';
        const cleanDetailLink = cleanStr(fullDetailLink);
        const cleanTitle = cleanStr(title);
        const cleanDate = cleanStr(date);

        allEvents.push({
          id: 'rh-' + (allEvents.length + 1),
          title: cleanTitle,
          date: cleanDate,
          image: cleanImage,
          ticketUrl: cleanTicketUrl,
          detailLink: cleanDetailLink
        });
      }
    }

    console.log('✅ 최종 스크래핑된 이벤트:', allEvents.length);
    res.status(200).json({ events: allEvents, debug: debugMessages });
  } catch (error) {
    console.error('❌ [rollinghall-events] 롤링홀 이벤트 로드 오류:', error);
    res.status(500).json({ error: 'Failed to fetch Rolling Hall events', details: error.message });
  }
};