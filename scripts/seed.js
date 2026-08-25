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
                // 한국어 주소와 영어 주소를 각각 가져오기
                const koreanDetails = await googlePlaces.getPlaceDetails(placeId, [
                    'name', 'formatted_address', 'geometry/location', 'photos',
                    'website', 'opening_hours', 'international_phone_number',
                    'rating', 'user_ratings_total'
                ], 'ko'); // language=ko로 한국어 주소 가져오기
                
                const englishDetails = await googlePlaces.getPlaceDetails(placeId, [
                    'formatted_address'
                ], 'en'); // language=en으로 영어 주소 가져오기

                if (koreanDetails) {
                    const name = koreanDetails.name;
                    const koreanAddress = koreanDetails.formatted_address;
                    const englishAddress = englishDetails?.formatted_address || koreanAddress; // 영어 주소가 없으면 한글 주소로 대체
                    
                    // 요청대로: 한국어(ko)만 한글, 나머지(en/zh/ja)는 모두 영어 주소로
                    const address = {
                        ko: koreanAddress,
                        en: englishAddress,
                        zh: englishAddress,
                        ja: englishAddress
                    };
                    const latitude = koreanDetails.geometry.location.lat;
                    const longitude = koreanDetails.geometry.location.lng;
                    const phoneNumber = koreanDetails.international_phone_number || null;
                    const websiteUrl = koreanDetails.website || null;
                    const googlePlaceId = placeId;
                    const description = null;
                    const image_urls = koreanDetails.photos ? koreanDetails.photos.map(photo =>
                        googlePlaces.getPhotoUrl(photo.photo_reference)
                    ) : [];
                    const opening_hours = koreanDetails.opening_hours ? JSON.stringify(koreanDetails.opening_hours.weekday_text) : null;

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
            // 구글에서 최신 정보 가져오기: 한국어 주소(ko)는 한글, 영어 주소(en)는 영어로 각각 가져오기
            const koreanDetails = await googlePlaces.getPlaceDetails(venue.googlePlaceId, [
                'name', 'formatted_address', 'geometry/location'
            ], 'ko'); // 한국어 주소
            
            const englishDetails = await googlePlaces.getPlaceDetails(venue.googlePlaceId, [
                'formatted_address'
            ], 'en'); // 영어 주소
            
            let newArea = venue.area; // 기존 area 유지
            let koreanAddress = '';
            
            if (koreanDetails && koreanDetails.formatted_address) {
                koreanAddress = koreanDetails.formatted_address;
                const englishAddress = englishDetails?.formatted_address || koreanAddress; // 영어 주소가 없으면 한글 주소로 대체
                
                // 숙명여대 인근 주소 확인 후 area를 sukmyung으로 변경, 기존 sookmyung도 모두 sukmyung으로 통일
                if (koreanAddress.includes('청파동') || koreanAddress.includes('서계동') || 
                    koreanAddress.includes('용산구 독서당로') || koreanAddress.includes('숙명여대') || venue.area === 'sookmyung') {
                    newArea = 'sukmyung';
                }
                
                // 요청대로: 한국어(ko)만 한글, 나머지(en/zh/ja)는 모두 영어 주소로
                const address = {
                    ko: koreanAddress,
                    en: englishAddress,
                    zh: englishAddress,
                    ja: englishAddress
                };
                updatedVenues.push({ ...venue, address, area: newArea });
                console.log(`주소 업데이트 완료: ${venue.name} - ${koreanAddress} (area: ${newArea})`);
            } else {
                // 정보를 가져오지 못한 경우 기존 주소를 객체로 변환하되, 기존 영어 주소가 있으면 사용
                const existingKoreanAddress = typeof venue.address === 'string' ? venue.address : venue.address?.ko || '주소 정보 없음';
                const existingEnglishAddress = typeof venue.address === 'object' && venue.address?.en ? venue.address.en : existingKoreanAddress;
                
                // 기존 주소로도 숙명 인근 확인
                if (existingKoreanAddress.includes('청파동') || existingKoreanAddress.includes('서계동') || 
                    existingKoreanAddress.includes('용산구 독서당로') || existingKoreanAddress.includes('숙명여대')) {
                    newArea = 'sukmyung';
                }
                const address = {
                    ko: existingKoreanAddress,
                    en: existingEnglishAddress,
                    zh: existingEnglishAddress,
                    ja: existingEnglishAddress
                };
                updatedVenues.push({ ...venue, address, area: newArea });
                console.log(`주소 변환 완료 (기존 주소 사용): ${venue.name} (area: ${newArea})`);
            }
        } catch (error) {
            console.error(`${venue.name} 주소 업데이트 실패:`, error.message);
            // 오류 발생시 기존 주소 유지하면서 객체로 변환
            const existingKoreanAddress = typeof venue.address === 'string' ? venue.address : venue.address?.ko || '주소 정보 없음';
            const existingEnglishAddress = typeof venue.address === 'object' && venue.address?.en ? venue.address.en : existingKoreanAddress;
            let newArea = venue.area;
            
            // 기존 주소로도 숙명 인근 확인
            if (existingKoreanAddress.includes('청파동') || existingKoreanAddress.includes('서계동') || 
                existingKoreanAddress.includes('용산구 독서당로') || existingKoreanAddress.includes('숙명여대')) {
                newArea = 'sukmyung';
            }
            const address = {
                ko: existingKoreanAddress,
                en: existingEnglishAddress,
                zh: existingEnglishAddress,
                ja: existingEnglishAddress
            };
            updatedVenues.push({ ...venue, address, area: newArea });
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
    // 신촌 기존 검색어
    newVenues.push(...await fetchPlacesData("신촌 라이브 공연장", "sinchon", "live_venue"));
    newVenues.push(...await fetchPlacesData("신촌 락바", "sinchon", "rock_bar"));
    newVenues.push(...await fetchPlacesData("신촌 딥퍼플", "sinchon", "live_venue"));
    newVenues.push(...await fetchPlacesData("신촌 딥퍼플 라이브 공연장", "sinchon", "live_venue"));
    // 숙명여대 근처 검색어 추가
    newVenues.push(...await fetchPlacesData("숙명여대 라이브 공연장", "sukmyung", "live_venue"));
    newVenues.push(...await fetchPlacesData("청파동 라이브 펍", "sukmyung", "pub"));
    newVenues.push(...await fetchPlacesData("서계동 락바", "sukmyung", "rock_bar"));
    newVenues.push(...await fetchPlacesData("용산구 숙명여대 근처 바", "sukmyung", "bar"));
    newVenues.push(...await fetchPlacesData("숙명여대 앞 라이브하우스", "sukmyung", "live_venue"));
    // 홍대 듈 스튜디오 추가
    newVenues.push(...await fetchPlacesData("홍대 듈 스튜디오", "hongdae", "live_venue"));

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