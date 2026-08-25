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
                    const koreanAddress = details.formatted_address;
                    // 기존처럼 다국어 주소 객체로 생성 (한글 주소를 기본으로, 다른 언어는 영어로 통일)
                    const address = {
                        ko: koreanAddress,
                        en: koreanAddress, // 원래 기획대로 다른 언어는 영어로 (한글 주소가 한국어이지만 구글에서 한국어로 가져오므로 그대로 사용)
                        zh: koreanAddress,
                        ja: koreanAddress
                    };
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

async function updateAllVenuesAddresses(venues) {
    console.log("기존 모든 공연장의 주소를 업데이트 중...");
    const updatedVenues = [];
    
    for (const venue of venues) {
        try {
            // 구글에서 최신 정보(한글 주소) 가져오기 (모든 장소에 대해 매번 실행)
            const details = await googlePlaces.getPlaceDetails(venue.googlePlaceId, [
                'name', 'formatted_address', 'geometry/location'
            ]);
            
            if (details && details.formatted_address) {
                const koreanAddress = details.formatted_address;
                const address = {
                    ko: koreanAddress,
                    en: koreanAddress,
                    zh: koreanAddress,
                    ja: koreanAddress
                };
                updatedVenues.push({ ...venue, address });
                console.log(`주소 업데이트 완료: ${venue.name} - ${koreanAddress}`);
            } else {
                // 정보를 가져오지 못한 경우 기존 주소를 객체로 변환
                const existingAddress = typeof venue.address === 'string' ? venue.address : venue.address?.ko || '주소 정보 없음';
                const address = {
                    ko: existingAddress,
                    en: existingAddress,
                    zh: existingAddress,
                    ja: existingAddress
                };
                updatedVenues.push({ ...venue, address });
                console.log(`주소 변환 완료 (기존 주소 사용): ${venue.name}`);
            }
        } catch (error) {
            console.error(`${venue.name} 주소 업데이트 실패:`, error.message);
            // 오류 발생시 기존 주소 유지하면서 객체로 변환
            const existingAddress = typeof venue.address === 'string' ? venue.address : venue.address?.ko || '주소 정보 없음';
            const address = {
                ko: existingAddress,
                en: existingAddress,
                zh: existingAddress,
                ja: existingAddress
            };
            updatedVenues.push({ ...venue, address });
        }
    }
    return updatedVenues;
}

async function seedInitialData() {
    console.log("Starting initial data seeding...");
    let allVenues = [];

    // 기존 venues.json 파일에서 데이터 읽어오기
    const existingPath = path.join(__dirname, '..', 'client/public', 'venues.json');
    try {
        const existingData = await fs.readFile(existingPath, 'utf8');
        allVenues = JSON.parse(existingData);
        console.log(`기존 장소 ${allVenues.length}개를 불러왔습니다.`);
        
        // 모든 기존 장소의 주소 업데이트
        allVenues = await updateAllVenuesAddresses(allVenues);
        console.log(`모든 기존 장소의 주소 업데이트 완료`);
    } catch (error) {
        console.log('기존 venues.json 파일이 없거나 읽을 수 없어 새로 생성합니다.');
    }

    // 새로운 장소들 추가
    const newVenues = [];
    newVenues.push(...await fetchPlacesData("신촌 라이브 공연장", "sinchon", "live_venue"));
    newVenues.push(...await fetchPlacesData("신촌 락바", "sinchon", "rock_bar"));
    newVenues.push(...await fetchPlacesData("신촌 딥퍼플", "sinchon", "live_venue"));
    newVenues.push(...await fetchPlacesData("신촌 딥퍼플 라이브 공연장", "sinchon", "live_venue"));

    // 중복 제거 (기존에 같은 id가 있으면 건너뛰기)
    const existingIds = new Set(allVenues.map(v => v.id));
    const uniqueNewVenues = newVenues.filter(v => !existingIds.has(v.id));
    allVenues = allVenues.concat(uniqueNewVenues);

    const outputPath = path.join(__dirname, '..', 'client/public', 'venues.json');
    const outputDir = path.dirname(outputPath);

    try {
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(allVenues, null, 2), 'utf8');
        console.log(`Successfully saved ${allVenues.length} venues to ${outputPath}`);
        console.log(`새로 추가된 장소: ${uniqueNewVenues.length}개`);
    } catch (error) {
        console.error('Error writing venues.json:', error.message);
    }

    console.log("Initial data seeding completed.");
    process.exit(0);
}

seedInitialData();