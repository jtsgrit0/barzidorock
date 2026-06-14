import React from 'react';
import { NavLink } from 'react-router-dom';
import './TabBar.css';

const TabBar = () => {
  return (
    <div className="tab-bar">
      <NavLink to="/" className="tab-item" activeClassName="active">
        홈
      </NavLink>
      <NavLink to="/tickets" className="tab-item" activeClassName="active">
        티켓
      </NavLink>
      <NavLink to="/schedule" className="tab-item" activeClassName="active">
        스케줄
      </NavLink>
      <NavLink to="/options" className="tab-item" activeClassName="active">
        옵션
      </NavLink>
    </div>
  );
};

export default TabBar;