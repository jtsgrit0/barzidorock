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
        const ticketTd = detail$('td:contains("예매하기")');
        if (ticketTd.length > 0) {
          const nextTd = ticketTd.next('td');
          ticketUrl = nextTd.find('a').attr('href') || nextTd.text().trim();
          debugMessages.push(`  Extracted ticketUrl from next td: ${ticketUrl}`);
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

    // 2. Scrape basic info from the list page
    const eventLinks = $('a[href*="com_board_basic=read_form"]');
    debugMessages.push(`Found ${eventLinks.length} potential event links.`);

    const preliminaryEvents = eventLinks.map((i, linkElement) => {
      const titleSpan = $(linkElement).find('span.gallery_title');
      if (titleSpan.length === 0) return null;

      const title = titleSpan.text().trim();
      const detailPageLink = $(linkElement).attr('href');
      const parentTr = $(linkElement).closest('tr');
      const dateTr = parentTr.next('tr');
      const dateTd = dateTr.find('td.gallery_etc');
      let date = '';
      if (dateTd.length > 0) {
        const dateMatch = dateTd.text().match(/(\d{4})\S+\s*(\d{2})\S+\s*(\d{2})\S+/);
        if (dateMatch) date = `${dateMatch[1]}년 ${dateMatch[2]}월 ${dateMatch[3]}일`;
      }

      const eventTable = $(linkElement).closest('table');
      let image = null;
      if (eventTable.length > 0) {
        const imageElement = eventTable.find('td[valign="bottom"][align="center"] img');
        if (imageElement.length > 0) image = imageElement.attr('src');
      }

      if (detailPageLink && title && date) {
        return {
          id: `rh-${i + 1}`,
          title,
          date,
          detailPageLink, // Temporary link to be used for fetching ticketUrl
          image: image ? `https://www.rollinghall.co.kr${image}` : 'https://picsum.photos/400/300?random=' + (i + 1)
        };
      }
      return null;
    }).get().filter(e => e !== null); // .get() converts cheerio object to array, .filter removes nulls

    debugMessages.push(`Successfully scraped ${preliminaryEvents.length} preliminary events.`);

    // 3. Fetch all detail pages in parallel
    const ticketUrlPromises = preliminaryEvents.map(event => fetchTicketUrl(event, debugMessages));
    const events = await Promise.all(ticketUrlPromises);

    debugMessages.push(`Finished scraping. Total events found: ${events.length}`);
    console.log('fetchRollingHallEvents Debug:', debugMessages.join('\n'));
    return { events, debug: debugMessages.join('\n') };

  } catch (error) {
    const errorMsg = `Error in fetchRollingHallEvents: ${error.message}`;
    debugMessages.push(errorMsg);
    console.error(errorMsg, error.stack);
    return { events: [], error: errorMsg, debug: debugMessages.join('\n') };
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