const API_FALLBACK = 'https://barzidorock.vercel.app';

const getVenueUrls = () => {
  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const urls = [];

  if (publicUrl) {
    urls.push(`${publicUrl}/venues.json`);
  }
  urls.push('/venues.json');
  urls.push(`${API_FALLBACK}/venues.json`);

  return [...new Set(urls)];
};

export const fetchVenues = async () => {
  const urls = getVenueUrls();
  let lastError;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error(`Invalid venues data from ${url}`);
      }
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`fetchVenues: failed to load from ${url}`, error);
    }
  }

  throw lastError || new Error('Failed to load venues');
};
