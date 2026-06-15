import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import MapComponent from './components/MapComponent';
import HeaderAndCategories from './components/HeaderAndCategories';
import TabBar from './components/TabBar';
import NotReadyPopup from './components/NotReadyPopup';
import FavoritesPage from './components/FavoritesPage';
import OptionsPage from './components/OptionsPage';
import venuesData from './venues.json';
import './App.css'; // Import App.css for popup styling

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

function App() {
  const [venues, setVenues] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('hongdae');
  const [mapCenter, setMapCenter] = useState({ lat: 37.5576, lng: 126.921 });
  const [mapZoom, setMapZoom] = useState(15);
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [locationAccessGranted, setLocationAccessGranted] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [language, setLanguage] = useState('ko');
  const [favorites, setFavorites] = useState([]);
  const [translations, setTranslations] = useState({});

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const localeData = await import(`./locales/${language}.json`);
        setTranslations(localeData.default);
      } catch (error) {
        console.error("Could not load translations for the selected language.", error);
      }
    };
    loadTranslations();
  }, [language]);

  useEffect(() => {
    const storedFavorites = localStorage.getItem('favorites');
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    setVenues(venuesData);
  }, []);

  // Check for location consent on app load
  useEffect(() => {
    const consent = localStorage.getItem('locationConsent');
    if (consent === 'granted') {
      setLocationAccessGranted(true);
    } else if (consent === null) {
      setShowLocationConsent(true);
    }
  }, []);

  // Start or stop watching location based on consent
  useEffect(() => {
    let watchId = null;
    if (locationAccessGranted) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
          },
          (error) => {
            console.error("Error watching user location:", error);
            if (error.code === error.PERMISSION_DENIED) {
              alert("위치 정보 접근이 거부되었습니다. 설정을 확인해주세요.");
              setLocationAccessGranted(false); // This will trigger the effect to re-run and clean up
              localStorage.setItem('locationConsent', 'denied');
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        alert("이 브라우저에서는 위치 정보 기능을 지원하지 않습니다.");
        setLocationAccessGranted(false);
        localStorage.setItem('locationConsent', 'denied');
      }
    } else {
      // If consent is revoked or not granted, clear the location
      setUserLocation(null);
    }

    // Cleanup function to clear the watch
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [locationAccessGranted]);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    let newCenter;
    let newZoom;

    if (category === 'hongdae') {
      newCenter = { lat: 37.5576, lng: 126.921 };
      newZoom = 15;
    } else if (category === 'itaewon') {
      newCenter = { lat: 37.5345, lng: 126.990 };
      newZoom = 15;
    } else { // 'all'
      newCenter = { lat: 37.5550354, lng: 126.929 };
      newZoom = 12;
    }
    setMapCenter(newCenter);
    setMapZoom(newZoom);
  };



  // Handle user's location consent
  const handleLocationConsent = (granted) => {
    localStorage.setItem('locationConsent', granted ? 'granted' : 'denied');
    setLocationAccessGranted(granted);
    setShowLocationConsent(false);
  };

  // Function to center map to user's location, to be passed to MapComponent
  const centerMapToUserLocation = useCallback(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(15); // Zoom in when centering to user's location
    } else if (locationAccessGranted) {
      alert("현재 위치를 파악 중입니다. 잠시 후 다시 시도해주세요.");
    } else {
      // If access was denied or not yet granted, show consent popup again
      setShowLocationConsent(true);
    }
  }, [userLocation, locationAccessGranted]);

  const toggleFavorite = (venueId) => {
    setFavorites(prevFavorites => {
      if (prevFavorites.includes(venueId)) {
        return prevFavorites.filter(id => id !== venueId);
      } else {
        return [...prevFavorites, venueId];
      }
    });
  };

  const filteredVenues = selectedCategory === 'all'
    ? venues
    : venues.filter(v => v.area === selectedCategory);

  return (
    <Router>
      <div className="App">
        <LoadScript googleMapsApiKey={API_KEY}>
          <HeaderAndCategories
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            language={language}
            setLanguage={setLanguage}
            translations={translations}
          />
          <div className="main-content">
            <Routes>
              <Route path="/" element={
                <MapComponent
                  venues={filteredVenues}
                  center={mapCenter}
                  zoom={mapZoom}
                  userLocation={userLocation}
                  centerMapToUserLocation={centerMapToUserLocation}
                  language={language}
                  setLanguage={setLanguage}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  translations={translations}
                />
              } />
              <Route path="/tickets" element={<NotReadyPopup />} />
              <Route path="/favorites" element={
                <FavoritesPage 
                  venues={venues} 
                  favorites={favorites} 
                  language={language} 
                  toggleFavorite={toggleFavorite}
                  translations={translations}
                />} 
              />
              <Route path="/options" element={<OptionsPage />} />
            </Routes>
          </div>
          <TabBar centerMapToUserLocation={centerMapToUserLocation} />

          {showLocationConsent && (
            <div className="location-consent-popup-overlay">
              <div className="location-consent-popup">
                <h2>위치 정보 사용 동의</h2>
                <p>
                  현재 위치 정보를 사용하여 주변 BAR UNION을 찾고,
                  선택하신 BAR UNION까지의 경로를 안내해 드릴 수 있습니다.
                  동의하시겠습니까?
                </p>
                <div className="popup-actions">
                  <button onClick={() => handleLocationConsent(true)}>동의</button>
                  <button onClick={() => handleLocationConsent(false)}>거부</button>
                </div>
              </div>
            </div>
          )}
        </LoadScript>
      </div>
    </Router>
  );
}

export default App;