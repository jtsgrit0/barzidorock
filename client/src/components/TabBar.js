import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faTicket, faCalendarAlt, faCog, faCrosshairs } from '@fortawesome/free-solid-svg-icons';
import './TabBar.css';

const TabBar = ({ centerMapToUserLocation }) => {
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
        <span>스케줄</span>
      </NavLink>
      <NavLink to="/options" className={({ isActive }) => "tab-item" + (isActive ? " active" : "")}>
        <FontAwesomeIcon icon={faCog} />
        <span>옵션</span>
      </NavLink>
      <div className="tab-item" onClick={centerMapToUserLocation} style={{ cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faCrosshairs} />
        <span>내 위치</span>
      </div>
    </div>
  );
};

export default TabBar;