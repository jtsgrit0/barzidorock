require('dotenv').config();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// Helper function to fetch and parse a detail page
async function fetchTicketUrl(event, debugMessages) {
  const fullDetailPageUrl = `https://www.rollinghall.co.kr${event.detailPageLink}`;
  let ticketUrl = '';
  debugMessages.push(`  Fetching detail page: ${fullDetailPageUrl}`);

  try {
    const detailResponse = await fetch(fullDetailPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!detailResponse.ok) {
      debugMessages.push(`Failed to fetch detail page ${fullDetailPageUrl}: ${detailResponse.status} ${detailResponse.statusText}`);
      ticketUrl = fullDetailPageUrl; // Fallback to detail page URL on failure
    } else {
      const detailArrayBuffer = await detailResponse.arrayBuffer();
      const detailBuffer = Buffer.from(detailArrayBuffer);
      const detailHtml = iconv.decode(detailBuffer, 'EUC-KR');
      const detail$ = cheerio.load(detailHtml);

      const melonTicketLink = detail$('a[href*="ticket.melon.com"]').attr('href');
      if (melonTicketLink) {
        ticketUrl = melonTicketLink;
        debugMessages.push(`  Extracted melonTicketLink: ${ticketUrl}`);
      } else {
        // "예매하기"가 있는 td 바로 다음 td에서 a 태그의 href를 정확히 추출
        const ticketTd = detail$('td:contains("예매하기")');
        if (ticketTd.length > 0) {
          const nextTd = ticketTd.next('td');
          const ticketLink = nextTd.find('a').attr('href');
          if (ticketLink) {
            ticketUrl = ticketLink;
            debugMessages.push(`  Extracted ticketUrl from next td: ${ticketUrl}`);
          } else {
            // 단순히 다음 텍스트에서 URL만 추출하는 백업 로직
            const nextText = nextTd.text().trim();
            const urlMatch = nextText.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
              ticketUrl = urlMatch[0];
              debugMessages.push(`  Extracted ticketUrl from text: ${ticketUrl}`);
            }
          }
        }
      }
    }
  } catch (detailError) {
    debugMessages.push(`Error fetching or parsing detail page for ${fullDetailPageUrl}: ${detailError.message}`);
    ticketUrl = fullDetailPageUrl; // Fallback on error
  }

  // Combine with original event data, excluding the temporary detailPageLink
  const { detailPageLink, ...rest } = event;
  return { ...rest, ticketUrl: ticketUrl || fullDetailPageUrl }; // Ensure ticketUrl is never empty
}


// Main function to scrape Rolling Hall events
async function fetchRollingHallEvents() {
  const url = 'https://www.rollinghall.co.kr/default/mp3/mp3_sub2.php?sub=02';
  const debugMessages = [];

  try {
    // 1. Fetch the main list page
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

    // 2. Scraped basic info from the list page - UNIFIED SELECTOR that works for ALL cases
    const allRows = $('tr');
    debugMessages.push(`Found ${allRows.length} total table rows.`);

    const preliminaryEvents = [];
    // Process EVERY table row and extract events - this handles ALL HTML structures
    allRows.each((i, row) => {
      const linkInRow = $(row).find('a[href*="com_board_basic=read_form"]');
      if (linkInRow.length === 0) return; // skip rows without event links

      const textInRow = $(row).text().trim();
      if (!textInRow) return;

      const detailPageLink = $(linkInRow).attr('href');
      // Extract date from row text (works regardless of HTML structure)
      const dateMatch = textInRow.match(/(\d{4})\S+\s*(\d{2})\S+\s*(\d{2})\S+/);
      let date = '';
      if (dateMatch) date = `${dateMatch[1]}년 ${dateMatch[2]}월 ${dateMatch[3]}일`;
      if (!detailPageLink || !date) return; // skip if we don't have critical data

      // Clean up title
      const cleanTitle = textInRow.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').substring(0, 100).trim();
      
      // Extract image from THIS row (works for all HTML structures)
      let image = null;
      const imgInRow = $(row).find('img');
      if (imgInRow.length > 0) {
        const rawImgSrc = imgInRow.attr('src');
        if (rawImgSrc.startsWith('http')) {
          image = rawImgSrc;
        } else if (rawImgSrc.startsWith('/')) {
          image = `https://www.rollinghall.co.kr${rawImgSrc}`;
        } else {
          image = `https://www.rollinghall.co.kr/${rawImgSrc}`;
        }
      }

      // Avoid duplicates
      if (!preliminaryEvents.find(e => e.detailPageLink === detailPageLink)) {
        preliminaryEvents.push({
          id: `rh-${preliminaryEvents.length + 1}`,
          title: cleanTitle,
          date,
          detailPageLink,
          image: image || `https://picsum.photos/400/300?random=${preliminaryEvents.length + 1}`
        });
      }
    });



    debugMessages.push(`Successfully scraped ${preliminaryEvents.length} preliminary events.`);

    // 3. Fetch all detail pages in parallel, but limit to first 5 to avoid rate limits
    const limitedEvents = preliminaryEvents.slice(0, 10); // Limit to 10 to prevent timeouts
    debugMessages.push(`Processing ${limitedEvents.length} events (limited to prevent timeout).`);
    
    const ticketUrlPromises = limitedEvents.map(event => fetchTicketUrl(event, debugMessages));
    const events = await Promise.all(ticketUrlPromises);

    debugMessages.push(`Finished scraping. Total events found: ${events.length}`);
    console.log('fetchRollingHallEvents Debug:', debugMessages.join('\n'));
    return { events, debug: debugMessages.join('\n') };

  } catch (error) {
    const errorMsg = `Error in fetchRollingHallEvents: ${error.message}`;
    debugMessages.push(errorMsg);
    console.error(errorMsg, error.stack);
    // Return some dummy events to prevent empty client side display during debugging
    const dummyEvents = [
      {
        id: 'rh-dummy-1',
        title: 'Rolling Hall Live Concert (Fallback)',
        date: '2026년 07월 15일',
        image: 'https://picsum.photos/400/300?random=999',
        ticketUrl: 'https://www.rollinghall.co.kr'
      }
    ];
    return { events: dummyEvents, error: errorMsg, debug: debugMessages.join('\n') };
  }
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }
  
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'GET') {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const result = await fetchRollingHallEvents();
      const debugOutput = result.debug || 'No debug information available.';
      console.log('RollingHall API Debug Output:', debugOutput);

      res.status(200).json({
        events: result.events,
        error: result.error || null,
        debug: debugOutput
      });
    } catch (error) {
      console.error('Error in /api/rollinghall-events endpoint:', error);
      res.status(500).json({ events: [], error: 'Failed to fetch Rolling Hall events.', debug: `Caught error in module.exports: ${error.message}` });
    }
  } else {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};