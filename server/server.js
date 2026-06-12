const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // For making HTTP requests
const Tesseract = require('tesseract.js');
const { URL } = require('url'); // Node.js built-in URL module to resolve relative paths

const app = express();
const port = 3001; // Or any other port you prefer

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // For parsing application/json

const cheerio = require('cheerio');

// Endpoint to fetch website content
app.post('/api/fetch-schedule', async (req, res) => {
  const { url } = req.body;
  console.log(`Received request to fetch schedule for URL: ${url}`); // Log incoming request

  if (!url) {
    console.error('Error: URL is required in the request body.'); // Log error
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url);
    console.log(`Fetch response status for ${url}: ${response.status}`); // Log fetch status
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const htmlContent = await response.text();
    console.log(`Successfully fetched content from ${url}. Content length: ${htmlContent.length}`); // Log success

    // Use cheerio to parse the HTML
    const $ = cheerio.load(htmlContent);

    // Remove script and style tags to clean up the content
    $('script').remove();
    $('style').remove();

    const textContent = $('body').text(); // Extract all text from the body

    // Clean up the extracted text: remove excessive whitespace and newlines
    const cleanedTextContent = textContent
      .replace(/\s\s+/g, ' ') // Replace multiple spaces with a single space
      .split('\n') // Split by newline
      .map(line => line.trim()) // Trim each line
      .filter(line => line.length > 0) // Remove empty lines
      .join('\n'); // Join back with single newlines
    console.log('Cleaned Text Content Length:', cleanedTextContent.length);
    console.log('Cleaned Text Content (first 500 chars):', cleanedTextContent.substring(0, 500));

    // Extract all image URLs from the page, prioritizing images within <article> tags (Instagram posts)
    const imageUrls = [];
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

    // Perform OCR on the first 3 images (to avoid excessive processing)
    let ocrText = '\n\n--- OCR Text from Images ---\n';
    const ocrPromises = imageUrls.slice(0, 3).map(async (imgUrl, index) => {
      try {
        console.log(`Processing OCR for image ${index + 1}: ${imgUrl}`);
        const { data: { text: ocrResult } } = await Tesseract.recognize(imgUrl, 'kor+eng'); // Support Korean and English
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});