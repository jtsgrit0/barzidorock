const axios = require('axios');

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';
let API_KEY = null; // init 함수를 통해 설정될 예정

function init(apiKey) {
    API_KEY = apiKey;
    console.log('[googlePlaces.js] Initialized with API Key:', API_KEY ? '*****' + API_KEY.slice(-5) : 'Not Initialized');
}

async function textSearch(query, region = 'kr', language = 'ko') {
    if (!API_KEY) {
        console.error('[googlePlaces.js] API Key is not initialized. Call init() first.');
        throw new Error('Google Places API Key is not initialized.');
    }
    try {
        console.log(`[googlePlaces.js] Calling textSearch with query: "${query}"`);
        const response = await axios.get(`${BASE_URL}/textsearch/json`, {
            params: { query, region, language, key: API_KEY }
        });
        console.log('[googlePlaces.js] Text Search API Raw Response Data:', JSON.stringify(response.data, null, 2));
        return response.data.results;
    } catch (error) {
        console.error('[googlePlaces.js] Error in Google Places Text Search:', error.message);
        if (error.response) {
            console.error('[googlePlaces.js] Google API Error Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('[googlePlaces.js] Google API Error Status:', error.response.status);
            console.error('[googlePlaces.js] Google API Error Headers:', error.response.headers);
        } else if (error.request) {
            console.error('[googlePlaces.js] No response received:', error.request);
        } else {
            console.error('[googlePlaces.js] Error setting up request:', error.message);
        }
        throw error;
    }
}

async function getPlaceDetails(placeId, fields) {
    if (!API_KEY) {
        console.error('[googlePlaces.js] API Key is not initialized. Call init() first.');
        throw new Error('Google Places API Key is not initialized.');
    }
    try {
        console.log(`[googlePlaces.js] Calling getPlaceDetails for placeId: "${placeId}"`);
        const response = await axios.get(`${BASE_URL}/details/json`, {
            params: { place_id: placeId, fields: fields.join(','), key: API_KEY }
        });
        console.log('[googlePlaces.js] Place Details API Raw Response Data:', JSON.stringify(response.data, null, 2));
        return response.data.result;
    } catch (error) {
        console.error(`[googlePlaces.js] Error in Google Places getPlaceDetails for placeId ${placeId}:`, error.message);
        if (error.response) {
            console.error('[googlePlaces.js] Google API Detail Error Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('[googlePlaces.js] Google API Detail Error Status:', error.response.status);
            console.error('[googlePlaces.js] Google API Detail Error Headers:', error.response.headers);
        } else if (error.request) {
            console.error('[googlePlaces.js] No response received for details:', error.request);
        } else {
            console.error('[googlePlaces.js] Error setting up details request:', error.message);
        }
        throw error;
    }
}

function getPhotoUrl(photoReference, maxWidth = 400) {
    if (!API_KEY) {
        console.error('[googlePlaces.js] API Key is not initialized. Call init() first.');
        return ''; // API 키가 없으면 빈 문자열 반환 또는 오류 처리
    }
    return `${BASE_URL}/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${API_KEY}`;
}

module.exports = {
    init,
    textSearch,
    getPlaceDetails,
    getPhotoUrl
};