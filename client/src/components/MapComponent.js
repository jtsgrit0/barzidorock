import React, { useState, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, OverlayView } from '@react-google-maps/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faPhone, faMapMarkerAlt, faHeart } from '@fortawesome/free-solid-svg-icons';

const containerStyle = {
  width: '100%',
  height: '100%'
};

// Function to get the correct pane for the OverlayView
const getPixelPositionOffset = (width, height) => ({
  x: -(width / 2),
  y: -(height / 2),
});

function MapComponent({ venues, center, zoom, userLocation, centerMapToUserLocation, language, setLanguage, favorites, toggleFavorite, translations, initialOpenInfoWindows }) {
  const [openInfoWindowId, setOpenInfoWindowId] = useState(null);
  const [map, setMap] = useState(null);

  const onLoad = useCallback(function callback(mapInstance) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback(mapInstance) {
    setMap(null);
  }, []);

  const handleMarkerClick = (venueId) => {
    setOpenInfoWindowId(prevId => (prevId === venueId ? null : venueId));
    if (map) {
      const venue = venues.find(v => v.id === venueId);
      if (venue) {
        map.setZoom(16);
        const offsetLat = -0.005;
        const newCenter = {
          lat: venue.latitude + offsetLat,
          lng: venue.longitude,
        };
        map.panTo(newCenter);
      }
    }
  };

  const handleInfoWindowClose = () => {
    setOpenInfoWindowId(null);
  };

  const mapStyles = [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ];

  const selectedVenue = venues.find(venue => venue.id === openInfoWindowId);

  return (
    <>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          clickableIcons: false, // 기본 POI 아이콘 클릭 비활성화
          styles: mapStyles,
          streetViewControl: false, // '이동' 버튼 제거 (스트리트 뷰)
          mapTypeControl: false,    // '라이브 뷰' 버튼 제거 (지도 유형)
          fullscreenControl: false, // '전체 화면' 버튼 제거
          zoomControl: false,       // '확대/축소' 버튼 제거
          rotateControl: false,     // '회전' 버튼 제거
          scaleControl: false,      // '스케일' 버튼 제거
          disableDefaultUI: true,   // 모든 기본 UI 컨트롤 제거
          gestureHandling: 'greedy' // 한 손가락으로 지도 이동 및 확대/축소 허용
        }} // 커스텀 스타일 적용
      >
        {venues.map(venue => (
          <Marker
            key={venue.id}
            position={{ lat: venue.latitude, lng: venue.longitude }}
            onClick={() => handleMarkerClick(venue.id)}
            icon={{
              url: venue.type === 'live_venue' 
                ? 'https://maps.google.com/mapfiles/ms/icons/pink-dot.png' 
                : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            }}
          />
        ))}

        {selectedVenue && (
          <InfoWindow
            key={selectedVenue.id}
            position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div style={{ maxWidth: '85vw', padding: '10px', boxSizing: 'border-box', wordBreak: 'break-all', overflowX: 'hidden' }}>
              <div style={{ position: 'relative', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.5em', textAlign: 'center' }}>
                  {selectedVenue.name[language] || selectedVenue.name['en'] || selectedVenue.name}
                </h2>
                <FontAwesomeIcon 
                  icon={faHeart} 
                  style={{ 
                    position: 'absolute', 
                    right: 0, 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    cursor: 'pointer', 
                    color: favorites.includes(selectedVenue.id) ? 'red' : 'grey', 
                    fontSize: '1.5em' 
                  }} 
                  onClick={() => toggleFavorite(selectedVenue.id)} 
                />
              </div>

              {selectedVenue.image_urls && selectedVenue.image_urls.length > 0 && (
                <img 
                  src={selectedVenue.image_urls[0]} 
                  alt={selectedVenue.name[language] || selectedVenue.name['en'] || selectedVenue.name} 
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', margin: '10px 0' }} 
                />
              )}

              <div style={{ fontSize: '1em', color: '#333' }}>
                <p style={{ margin: '5px 0' }}>
                  <FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: '10px' }} /> 
                  {selectedVenue.address[language] || selectedVenue.address['en'] || selectedVenue.address}
                </p>
                {selectedVenue.phoneNumber && (
                  <p style={{ margin: '5px 0' }}>
                    <FontAwesomeIcon icon={faPhone} style={{ marginRight: '10px' }} /> 
                    {selectedVenue.phoneNumber}
                  </p>
                )}

              </div>

              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px', flexWrap: 'wrap' }}>
                <a href={`tel:${selectedVenue.phoneNumber}`} style={{ textDecoration: 'none', color: 'black', textAlign: 'center' }}>
                  <FontAwesomeIcon icon={faPhone} size="2x" />
                  <p style={{ margin: '5px 0' }}>{translations?.call || '전화걸기'}</p>
                </a>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedVenue.latitude},${selectedVenue.longitude}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'black', textAlign: 'center' }}>
                  <FontAwesomeIcon icon={faMapMarkerAlt} size="2x" />
                  <p style={{ margin: '5px 0' }}>{translations?.directions || '길찾기'}</p>
                </a>
                {selectedVenue.websiteUrl && (
                  <a href={selectedVenue.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'black', textAlign: 'center' }}>
                    <FontAwesomeIcon icon={faHome} size="2x" />
                    <p style={{ margin: '5px 0' }}>{translations?.website || '홈페이지'}</p>
                  </a>
                )}

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
      </GoogleMap>
    </>
  );
}

export default MapComponent;