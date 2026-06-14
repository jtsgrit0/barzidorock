import React, { useState, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, OverlayView } from '@react-google-maps/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const scheduleContainerStyle = {
  backgroundColor: '#222', // Dark background
  color: '#eee', // Light text
  padding: '20px',
  marginTop: '10px',
  border: '2px solid #e00', // Red border for rock feel
  borderRadius: '8px',
  fontFamily: 'monospace, sans-serif', // Edgy font
  maxHeight: '300px', // Limit height
  overflowY: 'auto', // Scroll if content is long
  whiteSpace: 'pre-wrap', // Preserve whitespace and wrap text
  wordBreak: 'break-word', // Break long words
  fontSize: '0.95em', // Slightly larger font
  lineHeight: '1.6', // Improved line spacing
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)', // Subtle shadow
  textAlign: 'left', // Ensure text is left-aligned
};

// Function to get the correct pane for the OverlayView
const getPixelPositionOffset = (width, height) => ({
  x: -(width / 2),
  y: -(height / 2),
});

function MapComponent({ venues, center, zoom, onFetchSchedule, scheduleContent, userLocation, centerMapToUserLocation, language, setLanguage }) {
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [map, setMap] = useState(null);

  const onLoad = useCallback(function callback(mapInstance) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback(mapInstance) {
    setMap(null);
  }, []);

  const handleMarkerClick = (venue) => {
    // websiteUrl이 없는 마커는 아무런 반응을 하지 않도록 합니다.
    if (!venue.websiteUrl) {
      console.log(`Venue ${venue.name} does not have a website URL. Skipping interaction.`);
      return;
    }

    setSelectedVenue(venue);
    if (map) {
      map.setZoom(16);

      // 기존 스케줄 콘텐츠를 즉시 지웁니다.
      if (onFetchSchedule) {
        onFetchSchedule(null, null); // Clear previous schedule content
      }

      // 맵의 중심을 마커 위치보다 약간 남쪽으로 이동시켜 팝업이 앱 제목에 가려지지 않도록 합니다.
      // 이 값은 실제 UI에 따라 조정이 필요할 수 있는 추정치입니다.
      const offsetLat = -0.005; // 위도를 약간 감소시켜 맵 중심을 남쪽으로 이동
      const newCenter = {
        lat: venue.latitude + offsetLat,
        lng: venue.longitude,
      };
      map.panTo(newCenter); // 새로운 중심으로 맵 이동

      // websiteUrl이 있는 경우에만 새로운 스케줄 가져오기를 요청합니다.
      if (onFetchSchedule) {
        onFetchSchedule(venue.websiteUrl, venue.id);
      }
    }
  };

  const handleInfoWindowClose = () => {
    setSelectedVenue(null);
    // InfoWindow가 닫히면 스케줄 콘텐츠도 지웁니다.
    if (onFetchSchedule) {
        onFetchSchedule(null, null);
    }
  };

  // 구글맵 기본 POI(관심 지점) 라벨을 숨기는 스타일
  const mapStyles = [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ];

  return (
    <>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: mapStyles,
          streetViewControl: false, // '이동' 버튼 제거 (스트리트 뷰)
          mapTypeControl: false,    // '라이브 뷰' 버튼 제거 (지도 유형)
          fullscreenControl: false, // '전체 화면' 버튼 제거
          zoomControl: false,       // '확대/축소' 버튼 제거
          rotateControl: false,     // '회전' 버튼 제거
          scaleControl: false,      // '스케일' 버튼 제거
          disableDefaultUI: true,   // 모든 기본 UI 컨트롤 제거
        }} // 커스텀 스타일 적용
      >
        {venues.map(venue => (
          <Marker
            key={venue.id}
            position={{ lat: venue.latitude, lng: venue.longitude }}
            onClick={() => handleMarkerClick(venue)}
          />
        ))}

        {selectedVenue && ( // selectedVenue가 설정된 경우에만 InfoWindow를 표시합니다.
          <InfoWindow
            position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div style={{ width: '250px' }}>
              <h2>
                {selectedVenue.name[language] || selectedVenue.name['en'] || selectedVenue.name}
                {selectedVenue.websiteUrl && (
                  <a href={selectedVenue.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '10px', color: 'black' }}>
                    <FontAwesomeIcon icon={faHome} />
                  </a>
                )}
              </h2>
              {selectedVenue.image_urls && selectedVenue.image_urls.length > 0 && (
                <img src={selectedVenue.image_urls[0]} alt={selectedVenue.name[language] || selectedVenue.name['en'] || selectedVenue.name} style={{ maxWidth: '230px', maxHeight: '130px', marginBottom: '10px' }} />
              )}
              <p>{selectedVenue.address[language] || selectedVenue.address['en'] || selectedVenue.address}</p>
              {selectedVenue.phoneNumber && <p>Phone: {selectedVenue.phoneNumber}</p>}
              {selectedVenue.opening_hours && selectedVenue.opening_hours[language] && <p>Hours: {JSON.parse(selectedVenue.opening_hours[language]).join(', ')}</p>}
              <div style={{ marginTop: '10px', textAlign: 'center', cursor: 'pointer' }}>
                <span onClick={() => setLanguage('ko')}>🇰🇷</span> <span onClick={() => setLanguage('en')}>🇬🇧</span> <span onClick={() => setLanguage('zh')}>🇨🇳</span> <span onClick={() => setLanguage('ja')}>🇯🇵</span>
              </div>
            </div>
          </InfoWindow>
        )}

        {userLocation && (
          <OverlayView
            position={userLocation}
            mapPaneName={OverlayView.MAP_PANE}
            getPixelPositionOffset={getPixelPositionOffset}
          >
            <div className="user-location-marker">
              <div className="pulse"></div>
            </div>
          </OverlayView>
        )}

        {userLocation && (
          <div className="my-location-button-container">
            <button onClick={centerMapToUserLocation} className="my-location-button">
              <span></span>
            </button>
          </div>
        )}
      </GoogleMap>

      {scheduleContent && ( // 스케줄 콘텐츠가 있는 경우에만 표시합니다.
        <div style={scheduleContainerStyle}>
          <h3>Concert Schedule (from {selectedVenue?.name}'s website)</h3>
          <div dangerouslySetInnerHTML={{ __html: scheduleContent }} />
          <p style={{ fontSize: '0.8em', color: '#aaa' }}>
            *참고: 다양한 웹사이트 구조에서 특정 공연 일정을 자동으로 추출하는 것은 복잡합니다.
            이 내용은 원시 웹사이트 데이터이며 완벽하게 포맷되지 않을 수 있습니다.
          </p>
        </div>
      )}
    </>
  );
}

export default MapComponent;