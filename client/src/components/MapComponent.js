import React, { useState, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 60px)'
};

const initialCenter = {
  lat: 37.5550354, // Center of Hongdae/Itaewon area
  lng: 126.929
};

function MapComponent({ venues }) {
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
      const offsetLat = venue.latitude - 0.012;
      map.panTo({ lat: offsetLat, lng: venue.longitude });
      map.setZoom(16);
    }
  };

  const handleInfoWindowClose = () => {
    setSelectedVenue(null);
  };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={initialCenter}
      zoom={13}
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