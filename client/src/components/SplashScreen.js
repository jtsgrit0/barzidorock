import React from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { assetUrl } from '../utils/assetUrl';
import '../SplashScreen.css';

const SplashScreen = () => {
  const { loading } = useLoading();
  return (
    <div className={`splash-screen ${!loading ? 'hide' : ''}`}>
      <img src={`${assetUrl('splash_icon.png')}?v=6`} alt="Loading..." className="splash-icon" />
    </div>
  );
};

export default SplashScreen;