const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // For making HTTP requests

const app = express();
const port = 3001; // Or any other port you prefer

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // For parsing application/json

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

    res.json({ content: htmlContent });
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error); // Log detailed error
    res.status(500).json({ error: 'Failed to fetch content', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});