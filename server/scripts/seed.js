require('dotenv').config({ path: './server/.env' }); // 상위 폴더의 .env 파일 로드
const googlePlaces = require('../services/googlePlaces');
googlePlaces.init(process.env.GOOGLE_PLACES_API_KEY);
const fs = require('fs').promises;
const path = require('path');

async function fetchPlacesData(query, area, type) {
    const venues = [];
    try {
        console.log(`Searching for: "${query}" in ${area} (${type})`);
        const places = await googlePlaces.textSearch(query);

        if (!places || places.length === 0) {
            console.log(`No places found for query "${query}".`);
            return venues;
        }

        for (const place of places) {
            const placeId = place.place_id;

            try {
                const details = await googlePlaces.getPlaceDetails(placeId, [
                    'name', 'formatted_address', 'geometry/location', 'photos',
                    'website', 'opening_hours', 'international_phone_number',
                    'rating', 'user_ratings_total'
                ]);

                if (details) {
                    const name = details.name;
                    const address = details.formatted_address;
                    const latitude = details.geometry.location.lat;
                    const longitude = details.geometry.location.lng;
                    const phoneNumber = details.international_phone_number || null;
                    const websiteUrl = details.website || null;
                    const googlePlaceId = placeId;
                    const description = null;
                    const image_urls = details.photos ? details.photos.map(photo =>
                        googlePlaces.getPhotoUrl(photo.photo_reference)
                    ) : [];
                    const opening_hours = details.opening_hours ? JSON.stringify(details.opening_hours.weekday_text) : null;

                    venues.push({
                        id: googlePlaceId,
                        name,
                        type,
                        address,
                        latitude,
                        longitude,
                        phoneNumber,
                        websiteUrl,
                        googlePlaceId,
                        description,
                        image_urls,
                        opening_hours,
                        area,
                        created_at: new Date().toISOString()
                    });
                    console.log(`Collected: ${name} (${area}, ${type})`);
                }
            } catch (detailError) {
                console.error(`Error fetching details for placeId ${placeId}:`, detailError.message);
                if (detailError.response) {
                    console.error('Google API Detail Error Response:', detailError.response.data);
                }
            }
        }
    } catch (error) {
        console.error(`Error in fetchPlacesData for query "${query}":`, error.message);
        if (error.response) {
            console.error('Google API Text Search Error Response:', error.response.data);
        }
    }
    return venues;
}

async function seedInitialData() {
    console.log("Starting initial data seeding...");
    let allVenues = [];

    allVenues = allVenues.concat(await fetchPlacesData("홍대 라이브 공연장", "hongdae", "live_venue"));
    allVenues = allVenues.concat(await fetchPlacesData("홍대 락바", "hongdae", "rock_bar"));
    allVenues = allVenues.concat(await fetchPlacesData("이태원 라이브 공연장", "itaewon", "live_venue"));
    allVenues = allVenues.concat(await fetchPlacesData("이태원 락바", "itaewon", "rock_bar"));

    const outputPath = path.join(__dirname, '../../client/public', 'venues.json');
    const outputDir = path.dirname(outputPath);

    try {
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(allVenues, null, 2), 'utf8');
        console.log(`Successfully saved ${allVenues.length} venues to ${outputPath}`);
    } catch (error) {
        console.error('Error writing venues.json:', error.message);
    }

    console.log("Initial data seeding completed.");
    process.exit(0);
}

seedInitialData();