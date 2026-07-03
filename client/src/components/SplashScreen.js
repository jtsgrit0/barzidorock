import React from 'react';
import '../SplashScreen.css';
import appIcon from './app_icon.png'; // app_icon.png를 직접 import

const SplashScreen = ({ loading }) => {
  return (
    <div className={`splash-screen ${!loading ? 'hide' : ''}`}>
      <img src={appIcon} alt="Loading..." className="splash-icon" />
    </div>
  );
};

export default SplashScreen;