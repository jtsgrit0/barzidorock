import React from 'react';
import '../SplashScreen.css';

const SplashScreen = ({ loading }) => {
  return (
    <div className={`splash-screen ${!loading ? 'hide' : ''}`}>
      <img src={`${process.env.PUBLIC_URL}/app_icon.png`} alt="Loading..." className="splash-icon" />
    </div>
  );
};

export default SplashScreen;