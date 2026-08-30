import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import MapComponent from './components/MapComponent';
import HeaderAndCategories from './components/HeaderAndCategories';
import TabBar from './components/TabBar';
import SchedulePage from './components/SchedulePage';
import FavoritesPage from './components/FavoritesPage';
import OptionsPage from './components/OptionsPage';
import TicketsPage from './components/TicketsPage';
import VenueManagerRegister from './components/VenueManagerRegister';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import SplashScreen from './components/SplashScreen';
import { fetchVenues } from './utils/fetchVenues';
import { LoadingProvider, useLoading } from './contexts/LoadingContext';
import './App.css';

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const GOOGLE_LIBRARIES = ['places'];

function AppContent() {
  const { t, i18n } = useTranslation();
  const { loading, setLoading } = useLoading();
  const [venues, setVenues] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('hongdae');
  const [mapCenter, setMapCenter] = useState({ lat: 37.5576, lng: 126.921 });
  const [mapZoom, setMapZoom] = useState(15);
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [locationAccessGranted, setLocationAccessGranted] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [venueImages, setVenueImages] = useState({});
  const venueImagesRef = useRef(venueImages);
  venueImagesRef.current = venueImages;
  const initialOpenInfoWindows = [];
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVenueId, setSearchVenueId] = useState(null);

  const fetchVenueImages = useCallback(async (venueId) => {
    if (venueImagesRef.current[venueId]) {
      return;
    }
    const venue = venues.find(v => v.id === venueId && v.googlePlaceId) || venues.find(v => v.id === venueId);
    if (venue && venue.googlePlaceId) {
      try {
        const place = new window.google.maps.places.Place({ id: venue.googlePlaceId });
        await place.fetchFields({ fields: ['photos'] });
        if (place.photos && place.photos.length > 0) {
          const photoUris = place.photos.slice(0, 5).map(p => p.getURI({ maxWidth: 400, maxHeight: 400 }));
          setVenueImages(prev => ({ ...prev, [venueId]: photoUris }));
        }
      } catch (error) {
        console.error(`Error fetching images for venue ${venueId}:`, error);
      }
    }
  }, [venues]);

  // language 상태와 setLanguage 함수를 i18n 인스턴스에서 직접 가져오도록 변경
  const language = i18n.language;
  const setLanguage = (lang) => i18n.changeLanguage(lang);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500); // 1.5초 후 스플래시 화면 숨기기
    return () => clearTimeout(timer);
  }, [setLoading]);

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
    fetchVenues()
      .then(data => {
        console.log('App.js: venues loaded successfully:', data.length, 'venues');
        setVenues(data);
      })
      .catch(error => console.error('App.js: Error fetching venues:', error));
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

  useEffect(() => {
    if ((selectedCategory === 'sukmyung' || selectedCategory === 'sinchon') && venues.length > 0) {
      const areaVenues = venues.filter(v => v.area === selectedCategory);
      areaVenues.forEach(venue => {
        if (venue.googlePlaceId && !venueImagesRef.current[venue.id]) {
          fetchVenueImages(venue.id);
        }
      });
    }
  }, [selectedCategory, venues, fetchVenueImages]);

  const handleLocationConsent = (granted) => {
    localStorage.setItem('locationConsent', granted ? 'granted' : 'denied');
    setLocationAccessGranted(granted);
    setShowLocationConsent(false);
  };

  const centerMapToUserLocation = useCallback(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(15);
    } else if (locationAccessGranted) {
      alert("현재 위치를 파악 중입니다. 잠시 후 다시 시도해주세요.");
    } else {
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
    } else if (category === 'sukmyung') {
      newCenter = { lat: 37.5465, lng: 126.967 };
      newZoom = 15;
    } else if (category === 'sinchon') {
      newCenter = { lat: 37.555, lng: 126.936 };
      newZoom = 15;
    } else if (category === 'suwon') {
      newCenter = { lat: 37.288, lng: 127.018 };
      newZoom = 13;
    } else { // 'all'
      newCenter = { lat: 37.5550354, lng: 126.929 };
      newZoom = 12;
    }
    setMapCenter(newCenter);
    setMapZoom(newZoom);
  };

  const handleSearch = (query, shouldNavigate = false) => {
    setSearchQuery(query);
    if (shouldNavigate && query.trim() !== '') {
      const lowerQuery = query.toLowerCase();
      const filteredForSearch = selectedCategory === 'all'
        ? venues
        : venues.filter(v => v.area === selectedCategory);

      const matchingVenue = filteredForSearch.find(v => {
        const name = typeof v.name === 'object' ? (v.name.ko || v.name.en || JSON.stringify(v.name)) : v.name;
        return name.toLowerCase().includes(lowerQuery);
      });

      if (matchingVenue) {
        setSearchVenueId(matchingVenue.id);
        setMapCenter({ lat: matchingVenue.latitude, lng: matchingVenue.longitude });
        setMapZoom(14);
        if (document.activeElement) {
          document.activeElement.blur();
        }
      } else {
        alert(`"${query}"에 해당하는 공연장을 찾을 수 없습니다.`);
        setSearchVenueId(null);
      }
    } else {
      setSearchVenueId(null);
    }
  };

  const filteredVenues = selectedCategory === 'all'
    ? venues
    : venues.filter(v => v.area === selectedCategory);

  const searchFilteredVenues = searchQuery.trim() === ''
    ? filteredVenues
    : filteredVenues.filter(v => {
        const name = typeof v.name === 'object' ? (v.name.ko || v.name.en || JSON.stringify(v.name)) : v.name;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      });

  return (
    <Router>
      <div className="App">
        <SplashScreen loading={loading} />
        <LoadScript googleMapsApiKey={API_KEY} libraries={GOOGLE_LIBRARIES}>
          <HeaderAndCategories
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            language={language}
            setLanguage={setLanguage}
            venues={venues}
            onSearch={handleSearch}
          />
          <div className="main-content">
            <Routes>
              <Route path="/" element={
                <MapComponent
                  venues={searchFilteredVenues}
                  center={mapCenter}
                  zoom={mapZoom}
                  userLocation={userLocation}
                  centerMapToUserLocation={centerMapToUserLocation}
                  language={language}
                  setLanguage={setLanguage}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  venueImages={venueImages}
                  fetchVenueImages={fetchVenueImages}
                  translations={{
                    call: t('call'),
                    directions: t('directions'),
                    website: t('website')
                  }}
                  initialOpenInfoWindows={initialOpenInfoWindows}
                  activeVenueId={searchVenueId}
                />
              } />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/schedule" element={<SchedulePage language={language} />} />
              <Route path="/venue-register" element={<VenueManagerRegister />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/favorites" element={
                <FavoritesPage 
                  venues={venues} 
                  favorites={favorites} 
                  language={language} 
                  toggleFavorite={toggleFavorite}
                  venueImages={venueImages}
                  fetchVenueImages={fetchVenueImages}
                  translations={{
                    no_favorites: t('favoritesPage.no_favorites'),
                    remove_favorite: t('favoritesPage.remove_favorite'),
                    confirm_remove: t('favoritesPage.confirm_remove')
                  }}
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
                  현재 위치 정보를 사용하여 주변 라이브 콘서트 스테이지를 찾고,
                  선택하신 라이브 콘서트 스테이지까지의 경로를 안내해 드릴 수 있습니다.
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

function App() {
  return (
    <LoadingProvider>
      <AppContent />
    </LoadingProvider>
  );
}

export default App;