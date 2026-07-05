import React from 'react';
import { assetUrl } from '../utils/assetUrl';
import '../SplashScreen.css';

const SplashScreen = ({ loading }) => {
  return (
    <div className={`splash-screen ${!loading ? 'hide' : ''}`}>
      <img src={`${assetUrl('app_icon.png')}?v=4`} alt="Loading..." className="splash-icon" />
    </div>
  );
};

export default SplashScreen;