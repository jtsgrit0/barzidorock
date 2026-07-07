import React from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { assetUrl } from '../utils/assetUrl';
import '../SplashScreen.css';

const SplashScreen = () => {
  const { loading } = useLoading();
  return (
    <div className={`splash-screen ${!loading ? 'hide' : ''}`}>
      <img src={`${assetUrl('logo512.png')}?v=5`} alt="Loading..." className="splash-icon" />
    </div>
  );
};

export default SplashScreen;