import React, { useState, useEffect } from 'react';
import { LoadScript } from '@react-google-maps/api';
import MapComponent from './components/MapComponent';
import HeaderAndCategories from './components/HeaderAndCategories';
import venuesData from './venues.json';

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

function App() {
  const [venues, setVenues] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('hongdae');
  const [mapCenter, setMapCenter] = useState({ lat: 37.5550354, lng: 126.929 });
  const [mapZoom, setMapZoom] = useState(13);
  const [fetchedScheduleContent, setFetchedScheduleContent] = useState(null); // State for fetched content

  useEffect(() => {
    setVenues(venuesData);
  }, []);

  useEffect(() => {
    let newCenter = { lat: 37.5550354, lng: 126.929 };
    let newZoom = 13;
    if (selectedCategory === 'hongdae') {
      newCenter = { lat: 37.5576, lng: 126.921 };
      newZoom = 15;
    } else if (selectedCategory === 'itaewon') {
      newCenter = { lat: 37.5345, lng: 126.990 };
      newZoom = 15;
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
    setFetchedScheduleContent('<p>Loading schedule...</p>'); // Show loading message
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
    } finally {
      // setIsLoadingSchedule(false); // Removed as isLoadingSchedule state is no longer used
    }
  };

  return (
    <div className="App">
      <LoadScript googleMapsApiKey={API_KEY}>
        <HeaderAndCategories
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
        <MapComponent
          venues={venues.filter(v => v.area === selectedCategory)}
          center={mapCenter}
          zoom={mapZoom}
          onFetchSchedule={handleFetchSchedule} // Pass the handler
          scheduleContent={fetchedScheduleContent} // Pass the fetched content
        />
      </LoadScript>
    </div>
  );
}

export default App;