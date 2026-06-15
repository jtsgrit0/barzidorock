import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhone, faMapMarkerAlt, faClock, faHeart, faHome } from '@fortawesome/free-solid-svg-icons';

const FavoritesPage = ({ venues, favorites, language, toggleFavorite }) => {
  const favoriteVenues = venues.filter(venue => favorites.includes(venue.id));

  return (
    <div style={{ padding: '20px', backgroundColor: '#111', minHeight: '100vh' }}>
      <h1 style={{ color: '#eee', textAlign: 'center', marginBottom: '30px' }}>내가 찜한 장소</h1>
      {favoriteVenues.length > 0 ? (
        <div>
          {favoriteVenues.map(venue => (
            <div key={venue.id} style={{ backgroundColor: '#222', color: '#eee', padding: '20px', margin: '15px 0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.8em', color: '#e00' }}>
                  {venue.name[language] || venue.name['en']}
                </h2>
                <FontAwesomeIcon 
                  icon={faHeart} 
                  style={{ cursor: 'pointer', color: 'red', fontSize: '1.8em' }} 
                  onClick={() => toggleFavorite(venue.id)} 
                />
              </div>

              {venue.image_urls && venue.image_urls.length > 0 && (
                <img 
                  src={venue.image_urls[0]} 
                  alt={venue.name[language] || venue.name['en']} 
                  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', margin: '15px 0' }} 
                />
              )}

              <div style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
                <p style={{ margin: '8px 0' }}>
                  <FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: '12px', color: '#e00' }} /> 
                  {venue.address[language] || venue.address['en']}
                </p>
                {venue.phoneNumber && (
                  <p style={{ margin: '8px 0' }}>
                    <FontAwesomeIcon icon={faPhone} style={{ marginRight: '12px', color: '#e00' }} /> 
                    {venue.phoneNumber}
                  </p>
                )}
                {venue.opening_hours && (venue.opening_hours[language] || venue.opening_hours['en']) && (
                  <p style={{ margin: '8px 0' }}>
                    <FontAwesomeIcon icon={faClock} style={{ marginRight: '12px', color: '#e00' }} /> 
                    {(venue.opening_hours[language] || venue.opening_hours['en']).join(', ')}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px', borderTop: '1px solid #444', paddingTop: '20px' }}>
                <a href={`tel:${venue.phoneNumber}`} style={{ textDecoration: 'none', color: '#eee', textAlign: 'center' }}>
                  <FontAwesomeIcon icon={faPhone} size="2x" />
                  <p style={{ margin: '5px 0', fontSize: '0.9em' }}>전화걸기</p>
                </a>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#eee', textAlign: 'center' }}>
                  <FontAwesomeIcon icon={faMapMarkerAlt} size="2x" />
                  <p style={{ margin: '5px 0', fontSize: '0.9em' }}>길찾기</p>
                </a>
                {venue.websiteUrl && (
                  <a href={venue.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#eee', textAlign: 'center' }}>
                    <FontAwesomeIcon icon={faHome} size="2x" />
                    <p style={{ margin: '5px 0', fontSize: '0.9em' }}>홈페이지</p>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#999', textAlign: 'center', fontSize: '1.2em' }}>찜한 장소가 없습니다.</p>
      )}
    </div>
  );
};

export default FavoritesPage;