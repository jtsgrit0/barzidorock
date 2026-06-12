import React, { useState, useEffect, useCallback } from 'react';
import { LoadScript } from '@react-google-maps/api';
import MapComponent from './components/MapComponent';
import HeaderAndCategories from './components/HeaderAndCategories';
import venuesData from './venues.json';
import './App.css'; // Import App.css for popup styling

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

function App() {
  const [venues, setVenues] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('hongdae');
  const [mapCenter, setMapCenter] = useState({ lat: 37.5550354, lng: 126.929 });
  const [mapZoom, setMapZoom] = useState(13);
  const [fetchedScheduleContent, setFetchedScheduleContent] = useState(null);
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [locationAccessGranted, setLocationAccessGranted] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    setVenues(venuesData);
  }, []);

  // Check for location consent on app load
  useEffect(() => {
    const consent = localStorage.getItem('locationConsent');
    if (consent === 'granted') {
      setLocationAccessGranted(true);
      getUserCurrentLocation();
    } else if (consent === null) {
      setShowLocationConsent(true);
    }
  }, []);

  useEffect(() => {
    let newCenter = { lat: 37.5550354, lng: 126.929 }; // Default center for 'all'
    let newZoom = 13; // Default zoom for 'all'

    if (selectedCategory === 'hongdae') {
      newCenter = { lat: 37.5576, lng: 126.921 };
      newZoom = 15;
    } else if (selectedCategory === 'itaewon') {
      newCenter = { lat: 37.5345, lng: 126.990 };
      newZoom = 15;
    } else if (selectedCategory === 'all') {
      newCenter = { lat: 37.5550354, lng: 126.929 };
      newZoom = 12;
    }
    setMapCenter(newCenter);
    setMapZoom(newZoom);
  }, [selectedCategory, venues]);

  // Function to fetch website content from the backend
  const handleFetchSchedule = async (url) => {
    if (!url) {
      setFetchedScheduleContent(null);
      return;
    }
    setFetchedScheduleContent('<p>Loading schedule...</p>');
    try {
      const response = await fetch('http://localhost:3001/api/fetch-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setFetchedScheduleContent(data.content);
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
      setFetchedScheduleContent('<p>Could not load schedule. The website might be down or blocking requests.</p>');
    }
  };

  // Handle user's location consent
  const handleLocationConsent = (granted) => {
    localStorage.setItem('locationConsent', granted ? 'granted' : 'denied');
    setLocationAccessGranted(granted);
    setShowLocationConsent(false);
    if (granted) {
      getUserCurrentLocation();
    }
  };

  // Get user's current location
  const getUserCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          // Optionally, center map to user's location immediately after getting it
          // setMapCenter({ lat: latitude, lng: longitude });
          // setMapZoom(15);
        },
        (error) => {
          console.error("Error getting user location:", error);
          alert("위치 정보를 가져오는 데 실패했습니다. 브라우저 설정에서 위치 정보 접근을 허용해주세요.");
          setLocationAccessGranted(false); // Revoke access if error
          localStorage.setItem('locationConsent', 'denied'); // Store as denied
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert("이 브라우저에서는 위치 정보 기능을 지원하지 않습니다.");
      setLocationAccessGranted(false); // Revoke access if not supported
      localStorage.setItem('locationConsent', 'denied'); // Store as denied
    }
  };

  // Function to center map to user's location, to be passed to MapComponent
  const centerMapToUserLocation = useCallback(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(15); // Zoom in when centering to user's location
    } else if (locationAccessGranted) {
      // If access was granted but location not yet fetched, try again
      getUserCurrentLocation();
    } else {
      // If access was denied or not yet granted, show consent popup again
      setShowLocationConsent(true);
    }
  }, [userLocation, locationAccessGranted]);

  const filteredVenues = selectedCategory === 'all'
    ? venues
    : venues.filter(v => v.area === selectedCategory);

  return (
    <div className="App">
      <LoadScript googleMapsApiKey={API_KEY}>
        <HeaderAndCategories
          onCategoryChange={setSelectedCategory}
        />
        <MapComponent
          venues={filteredVenues}
          center={mapCenter}
          zoom={mapZoom}
          onFetchSchedule={handleFetchSchedule}
          scheduleContent={fetchedScheduleContent}
          userLocation={userLocation}
          centerMapToUserLocation={centerMapToUserLocation}
        />

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
  );
}

export default App;