const API_FALLBACK = 'https://barzidorock.vercel.app';

const isGitHubPagesHost = () => (
  typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')
);

const getVenueUrls = () => {
  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const urls = [];

  // GitHub Pages에서 항상 Vercel에서 venues.json 불러오기
  if (isGitHubPagesHost()) {
    urls.push(`${API_FALLBACK}/venues.json`);
    return urls;
  }

  if (publicUrl) {
    urls.push(`${publicUrl}/venues.json`);
  }
  urls.push('/venues.json');
  urls.push(`${API_FALLBACK}/venues.json`);

  return [...new Set(urls)];
};

// 스케줄 API 호출시에도 GitHub Pages에서 CORS 문제 방지를 위해 API_FALLBACK 사용
export const getApiBaseUrl = () => {
  if (isGitHubPagesHost()) {
    return API_FALLBACK;
  }
  return process.env.REACT_APP_API_URL || API_FALLBACK;
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