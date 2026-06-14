import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faTicket, faCalendarAlt, faCog } from '@fortawesome/free-solid-svg-icons';
import './TabBar.css';

const TabBar = () => {
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
    </div>
  );
};

export default TabBar;