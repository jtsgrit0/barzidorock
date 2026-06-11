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
  const [selectedCategory, setSelectedCategory] = useState('all');

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
      })
      .catch(error => console.error("Error fetching venues:", error));
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredVenues(venues);
    } else {
      setFilteredVenues(venues.filter(venue => venue.area === selectedCategory));
    }
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
          <Route path="/" element={<MapComponent venues={filteredVenues} />} />
          <Route path="/venue/:id" element={<VenueDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;