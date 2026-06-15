import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faTicket, faCalendarAlt, faCog, faCrosshairs, faHeart } from '@fortawesome/free-solid-svg-icons';
import './TabBar.css';

const TabBar = ({ centerMapToUserLocation }) => {
  const navigate = useNavigate();

  const handleMyLocationClick = () => {
    navigate('/');
    // Use a short delay to ensure navigation completes before centering the map
    setTimeout(centerMapToUserLocation, 100);
  };

  return (
    <div className="tab-bar">
      <NavLink to="/" className={({ isActive }) => "tab-item" + (isActive ? " active" : "")} end>
        <FontAwesomeIcon icon={faHome} />
        <span>홈</span>
      </NavLink>
      <NavLink to="/tickets" className={({ isActive }) => "tab-item" + (isActive ? " active" : "")}>
        <FontAwesomeIcon icon={faTicket} />
        <span>티켓</span>
      </NavLink>
      <NavLink to="/schedule" className={({ isActive }) => "tab-item" + (isActive ? " active" : "")}>
        <FontAwesomeIcon icon={faCalendarAlt} />
        <span>공연일정</span>
      </NavLink>
      <NavLink to="/favorites" className={({ isActive }) => "tab-item" + (isActive ? " active" : "")}>
        <FontAwesomeIcon icon={faHeart} />
        <span>찜</span>
      </NavLink>
      <NavLink to="/options" className={({ isActive }) => "tab-item" + (isActive ? " active" : "")}>
        <FontAwesomeIcon icon={faCog} />
        <span>옵션</span>
      </NavLink>
      <div className="tab-item" onClick={handleMyLocationClick} style={{ cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faCrosshairs} />
        <span>내 위치</span>
      </div>
    </div>
  );
};

export default TabBar;