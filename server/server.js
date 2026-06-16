const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // For making HTTP requests
const Tesseract = require('tesseract.js');
const { URL } = require('url'); // Node.js built-in URL module to resolve relative paths
const Jimp = require('jimp'); // Add this line
const fs = require('fs').promises; // Add this line for file system operations
const puppeteer = require('puppeteer'); // Add this line

// Function to fetch Instagram images using Puppeteer
async function fetchInstagramImages(targetUrl) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true }); // Set to false for visual debugging
    const page = await browser.newPage();

    // Navigate to the target Instagram page
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    // Try to close any login/signup pop-up that might appear
    // Instagram's pop-up selectors can change, so this might need adjustment
    try {
      // Look for a common "Not Now" or "Close" button on pop-ups
      const closeButtonSelector = 'button._a9--._a9_1'; // Example selector for "Not Now" or "Close"
      await page.waitForSelector(closeButtonSelector, { timeout: 5000 });
      await page.click(closeButtonSelector);
      console.log('Instagram login/signup pop-up closed.');
    } catch (e) {
      console.log('No Instagram login/signup pop-up found or could not close it.');
    }

    // Wait a bit for the page to settle after closing the pop-up
    await page.waitForTimeout(2000); // Wait for 2 seconds

    // Extract image URLs
    const imageUrls = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('article img'));
      return images.map(img => img.src);
    });

    return imageUrls;
  } catch (error) {
    console.error('Error fetching Instagram images with Puppeteer:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const app = express();
const port = 3001; // Or any other port you prefer

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // For parsing application/json

const cheerio = require('cheerio');

// Endpoint to fetch website content
app.post('/api/fetch-schedule', async (req, res) => {
  const { websiteUrl: url } = req.body;
  console.log(`Received request to fetch schedule for URL: ${url}`); // Log incoming request

  if (!url) {
    console.error('Error: URL is required in the request body.'); // Log error
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    let imageUrls = [];
    let cleanedTextContent = '';

    if (url.includes('instagram.com')) {
      imageUrls = await fetchInstagramImages(url);
      console.log('Image URLs from Puppeteer:', imageUrls);

      // For Instagram, we might not get much text content directly, so we'll rely on OCR
      cleanedTextContent = 'Instagram content fetched via Puppeteer. Relying on OCR for schedule details.';

    } else {
      const response = await fetch(url);
      console.log(`Fetch response status for ${url}: ${response.status}`); // Log fetch status
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const htmlContent = await response.text();
      // Save HTML content to a file for inspection
      await fs.writeFile('instagram_unionseoul_html.html', htmlContent);
      console.log('HTML content saved to instagram_unionseoul_html.html');
      console.log(`Successfully fetched content from ${url}. Content length: ${htmlContent.length}`); // Log success

      // Use cheerio to parse the HTML
      const $ = cheerio.load(htmlContent);

      // Remove script and style tags to clean up the content
      $('script').remove();
      $('style').remove();

      const textContent = $('body').text(); // Extract all text from the body

      // Clean up the extracted text: remove excessive whitespace and newlines
      cleanedTextContent = textContent
        .replace(/\s\s+/g, ' ') // Replace multiple spaces with a single space
        .split('\n') // Split by newline
        .map(line => line.trim()) // Trim each line
        .filter(line => line.length > 0) // Remove empty lines
        .join('\n'); // Join back with single newlines
      console.log('Cleaned Text Content Length:', cleanedTextContent.length);
      console.log('Cleaned Text Content (first 500 chars):', cleanedTextContent.substring(0, 500));

      // Extract all image URLs from the page, prioritizing images within <article> tags (Instagram posts)
      $('article img').each((index, element) => {
        const imgSrc = $(element).attr('src');
        if (imgSrc) {
          try {
            // Resolve relative image URLs to absolute URLs
            const absoluteUrl = new URL(imgSrc, url).href;
            imageUrls.push(absoluteUrl);
          } catch (e) {
            console.log(`Skipping invalid image URL: ${imgSrc}`, e.message);
          }
        }
      });
      console.log('Found Image URLs within <article> tags:', imageUrls.length > 0 ? imageUrls.join(', ') : 'No images found in articles');

      // If no images found in articles, try to get general images (fallback)
      if (imageUrls.length === 0) {
        $('img').each((index, element) => {
          const imgSrc = $(element).attr('src');
          if (imgSrc) {
            try {
              const absoluteUrl = new URL(imgSrc, url).href;
              imageUrls.push(absoluteUrl);
            } catch (e) {
              console.log(`Skipping invalid image URL: ${imgSrc}`, e.message);
            }
          }
        });
        console.log('Found general Image URLs (fallback):', imageUrls.length > 0 ? imageUrls.join(', ') : 'No general images found');
      }
    }

    // Perform OCR on the first 3 images (to avoid excessive processing)
    let ocrText = '\n\n--- OCR Text from Images ---\n';
    const ocrPromises = imageUrls.slice(0, 3).map(async (imgUrl, index) => {
      try {
        let image = await Jimp.read(imgUrl);
        const processedImageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        // --- End Image Preprocessing ---

        const { data: { text: ocrResult } } = await Tesseract.recognize(processedImageBuffer, 'kor+eng'); // Use processed image buffer
        ocrText += `\n[Image ${index + 1}]:\n${ocrResult.trim()}`;
        console.log(`OCR successful for image ${index + 1}. Length: ${ocrResult.length}`);
      } catch (ocrError) {
        console.error(`OCR failed for image ${index + 1} (${imgUrl}):`, ocrError.message);
        ocrText += `\n[Image ${index + 1}]: OCR failed (${ocrError.message})`;
      }
    });

    // Wait for all OCR processes to complete
    await Promise.all(ocrPromises);

    // Combine original text with OCR text
    const finalContent = cleanedTextContent + ocrText;

    res.json({ content: finalContent });
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error); // Log detailed error
    res.status(500).json({ error: 'Failed to fetch content', details: error.message });
  }
});

const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig.development);

app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await knex('schedules')
      .join('venues', 'schedules.venue_id', 'venues.id')
      .select(
        'schedules.id',
        'schedules.event_date',
        'schedules.event_name',
        'schedules.description',
        'venues.name as venue_name'
      )
      .orderBy('schedules.event_date', 'asc');
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// IMPORTANT: Replace with your actual secret key and store it securely (e.g., environment variable)
const RECAPTCHA_SECRET_KEY = '6LfFviEtAAAAADfPFhv2KPq3oPIADahPzOqeJ1OL';

app.post('/api/schedules', async (req, res) => {
  const { venue_id, event_date, event_name, description, captcha } = req.body;

  // 1. Verify reCAPTCHA
  if (!captcha) {
    return res.status(400).json({ error: 'reCAPTCHA token is missing' });
  }

  try {
    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${captcha}`,
    });
    const recaptchaData = await recaptchaResponse.json();

    if (!recaptchaData.success) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed', 'error-codes': recaptchaData['error-codes'] });
    }

    // 2. Proceed with creating schedule if reCAPTCHA is valid
    if (!venue_id || !event_date || !event_name) {
      return res.status(400).json({ error: 'venue_id, event_date, and event_name are required' });
    }

    const [newSchedule] = await knex('schedules')
      .insert({
        venue_id,
        event_date,
        event_name,
        description,
      })
      .returning('*');
    res.status(201).json(newSchedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});