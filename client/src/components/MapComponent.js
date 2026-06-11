import React, { useState, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 60px)'
};

function MapComponent({ venues, center, zoom }) {
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [map, setMap] = useState(null);

  const onLoad = useCallback(function callback(mapInstance) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback(mapInstance) {
    setMap(null);
  }, []);

  const handleMarkerClick = (venue) => {
    setSelectedVenue(venue);
    if (map) {
      map.panTo({ lat: venue.latitude, lng: venue.longitude });
      map.setZoom(16);
    }
  };

  const handleInfoWindowClose = () => {
    setSelectedVenue(null);
  };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {venues.map(venue => (
        <Marker
          key={venue.id}
          position={{ lat: venue.latitude, lng: venue.longitude }}
          onClick={() => handleMarkerClick(venue)}
        />
      ))}

      {selectedVenue && (
        <InfoWindow
          position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
          pixelOffset={{ width: 0, height: -120 }} // 정보창을 위로 120px 이동
          onCloseClick={handleInfoWindowClose}
        >
          <div>
            <h2>{selectedVenue.name}</h2>
            {selectedVenue.image_urls && selectedVenue.image_urls.length > 0 && (
              <img src={selectedVenue.image_urls[0]} alt={selectedVenue.name} style={{ maxWidth: '200px', maxHeight: '150px', marginBottom: '10px' }} />
            )}
            <p>{selectedVenue.address}</p>
            {selectedVenue.phoneNumber && <p>Phone: {selectedVenue.phoneNumber}</p>}
            {selectedVenue.websiteUrl && <p><a href={selectedVenue.websiteUrl} target="_blank" rel="noopener noreferrer">Website</a></p>}
            {selectedVenue.opening_hours && <p>Hours: {JSON.parse(selectedVenue.opening_hours).join(', ')}</p>}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

export default MapComponent;