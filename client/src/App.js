import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useLoadScript } from '@react-google-maps/api';
import MapComponent from './components/MapComponent';
import HeaderAndCategories from './components/HeaderAndCategories';
import './App.css';
import './components/HeaderAndCategories.css';

// 임시 컴포넌트 (나중에 실제 컴포넌트로 대체될 예정)
const VenueDetail = () => <div>Venue Detail Page</div>;

const libraries = ["places"];

function App() {
  const [venues, setVenues] = useState([]);
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('hongdae');
  const [mapCenter, setMapCenter] = useState({ lat: 37.5550354, lng: 126.929 }); // 초기 중심 (홍대/이태원 중간)
  const [mapZoom, setMapZoom] = useState(13); // 초기 줌 레벨

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  useEffect(() => {
    fetch('/barzidorock/venues.json') // GitHub Pages의 경우 절대 경로 사용
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setVenues(data);
        setFilteredVenues(data);
        // 초기 로드 시 'all' 카테고리에 맞춰 맵 중심과 줌 설정
        setMapCenter({ lat: 37.5550354, lng: 126.929 });
        setMapZoom(13);
      })
      .catch(error => console.error("Error fetching venues:", error));
  }, []);

  useEffect(() => {
    let newCenter = { lat: 37.5550354, lng: 126.929 }; // 전체 초기 중심
    let newZoom = 13; // 전체 초기 줌

    if (selectedCategory === 'all') {
      setFilteredVenues(venues);
      newCenter = { lat: 37.5550354, lng: 126.929 }; // 전체
      newZoom = 13;
    } else if (selectedCategory === 'hongdae') {
      setFilteredVenues(venues.filter(venue => venue.area === 'hongdae'));
      newCenter = { lat: 37.5576, lng: 126.921 }; // 홍대 중심
      newZoom = 15;
    } else if (selectedCategory === 'itaewon') {
      setFilteredVenues(venues.filter(venue => venue.area === 'itaewon'));
      newCenter = { lat: 37.5345, lng: 126.990 }; // 이태원 중심
      newZoom = 15;
    }
    setMapCenter(newCenter);
    setMapZoom(newZoom);
  }, [selectedCategory, venues]);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  if (loadError) return "Error loading maps";
  if (!isLoaded) return "Loading Maps";

  return (
    <Router>
      <div className="App">
        <HeaderAndCategories onCategoryChange={handleCategoryChange} />
        <Routes>
          <Route path="/" element={<MapComponent venues={filteredVenues} center={mapCenter} zoom={mapZoom} />} />
          <Route path="/venue/:id" element={<VenueDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;