import React from 'react';

const FavoritesPage = ({ venues, favorites, language, toggleFavorite }) => {
  const favoriteVenues = venues.filter(venue => favorites.includes(venue.id));

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: '#eee' }}>내가 찜한 장소</h1>
      {favoriteVenues.length > 0 ? (
        <div>
          {favoriteVenues.map(venue => (
            <div key={venue.id} style={{ backgroundColor: '#333', color: '#eee', padding: '15px', margin: '10px 0', borderRadius: '8px' }}>
              <h2>{venue.name[language] || venue.name['en']}</h2>
              <p>{venue.address[language] || venue.address['en']}</p>
              <button onClick={() => toggleFavorite(venue.id)} style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '10px', borderRadius: '5px' }}>
                찜 해제
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#999' }}>찜한 장소가 없습니다.</p>
      )}
    </div>
  );
};

export default FavoritesPage;