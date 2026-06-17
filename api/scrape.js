const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let browser = null;
  try {
    const executablePath = await chrome.executablePath;

    browser = await puppeteer.launch({
      args: chrome.args,
      executablePath,
      headless: chrome.headless,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
      const placeName = document.querySelector('h1')?.innerText || null;
      const address = document.querySelector('[data-item-id^="address"]')?.innerText || null;
      const category = document.querySelector('button[jsaction="pane.rating.category"]')?.innerText || null;
      const phone = document.querySelector('[data-item-id^="phone"]')?.innerText || null;

      return { placeName, address, category, phone };
    });

    res.status(200).json(data);
  } catch (error) {
    console.error('Error scraping data:', error);
    res.status(500).json({ error: 'Failed to scrape data' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};