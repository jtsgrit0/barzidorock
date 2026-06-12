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
    let newCenter = { lat: 37.5550354, lng: 126.929 }; // Default center for 'all'
    let newZoom = 13; // Default zoom for 'all'

    if (selectedCategory === 'hongdae') {
      newCenter = { lat: 37.5576, lng: 126.921 };
      newZoom = 15;
    } else if (selectedCategory === 'itaewon') {
      newCenter = { lat: 37.5345, lng: 126.990 };
      newZoom = 15;
    } else if (selectedCategory === 'all') {
      // 'all' 카테고리일 때는 모든 마커를 볼 수 있는 넓은 지역으로 설정
      newCenter = { lat: 37.5550354, lng: 126.929 }; // 서울 중심 근처
      newZoom = 12; // 더 넓은 지역을 볼 수 있도록 줌 아웃
    }
    setMapCenter(newCenter);
    setMapZoom(newZoom);
  }, [selectedCategory, venues]);

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
          onFetchSchedule={handleFetchSchedule} // Pass the handler
          scheduleContent={fetchedScheduleContent} // Pass the fetched content
        />
      </LoadScript>
    </div>
  );
}

export default App;