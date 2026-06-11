import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 60px)'
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
};

function MapComponent({ venues, center, zoom, onFetchSchedule, scheduleContent }) {
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
      map.setPadding({ top: 100 }); // 상단에 100px 패딩 추가
      // websiteUrl이 있는 경우에만 스케줄 가져오기를 요청합니다.
      if (onFetchSchedule) {
        onFetchSchedule(venue.websiteUrl, venue.id);
      }
    }
  };

  const handleInfoWindowClose = () => {
    setSelectedVenue(null);
    if (map) {
      map.setPadding({ top: 0 }); // 패딩 초기화
    }
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
        options={{ styles: mapStyles }} // 커스텀 스타일 적용
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
            <div>
              <h2>{selectedVenue.name}</h2>
              {selectedVenue.image_urls && selectedVenue.image_urls.length > 0 && (
                <img src={selectedVenue.image_urls[0]} alt={selectedVenue.name} style={{ maxWidth: '200px', maxHeight: '150px', marginBottom: '10px' }} />
              )}
              <p>{selectedVenue.address}</p>
              {selectedVenue.phoneNumber && <p>Phone: {selectedVenue.phoneNumber}</p>}
              {selectedVenue.websiteUrl && (
                <p>
                  <a href={selectedVenue.websiteUrl} target="_blank" rel="noopener noreferrer">Website</a>
                </p>
              )}
              {selectedVenue.opening_hours && <p>Hours: {JSON.parse(selectedVenue.opening_hours).join(', ')}</p>}
            </div>
          </InfoWindow>
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