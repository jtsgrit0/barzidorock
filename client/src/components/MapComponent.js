import React, { useState } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '800px'
};

const center = {
  lat: 37.5550354, // Center of Hongdae/Itaewon area
  lng: 126.929
};

function MapComponent({ venues }) {
  const [selectedVenue, setSelectedVenue] = useState(null);

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
    >
      {venues.map(venue => (
        <Marker
          key={venue.id}
          position={{ lat: venue.latitude, lng: venue.longitude }}
          onClick={() => setSelectedVenue(venue)}
        />
      ))}

      {selectedVenue && (
        <InfoWindow
          position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
          onCloseClick={() => setSelectedVenue(null)}
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