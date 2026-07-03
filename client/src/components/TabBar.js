import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faTicket, faCalendarAlt, faCrosshairs, faHeart } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import './TabBar.css';

const TabBar = ({ centerMapToUserLocation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation(); // 현재 경로 가져오기

  // 모든 탭 클릭 시 페이지 맨 위로 스크롤하는 공통 함수
  const handleTabNavigation = (path) => {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 부드럽게 맨 위로 스크롤
    navigate(path);
  };

  // 현재 경로와 일치하는 탭에 active 클래스 추가
  const getTabClassName = (path) => {
    return `tab-item ${location.pathname === path ? 'active' : ''}`;
  };

  const handleMyLocationClick = () => {
    handleTabNavigation('/');
    // Use a short delay to ensure navigation completes before centering the map
    setTimeout(centerMapToUserLocation, 100);
  };

  return (
    <div className="tab-bar">
      <div className={getTabClassName('/')} onClick={() => handleTabNavigation('/')} style={{ cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faHome} />
        <span>{t('tabBar.home')}</span>
      </div>
      <div className={getTabClassName('/tickets')} onClick={() => handleTabNavigation('/tickets')} style={{ cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faTicket} />
        <span>{t('tabBar.tickets')}</span>
      </div>
      <div className={getTabClassName('/schedule')} onClick={() => handleTabNavigation('/schedule')} style={{ cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faCalendarAlt} />
        <span>{t('tabBar.schedule')}</span>
      </div>
      <div className={getTabClassName('/favorites')} onClick={() => handleTabNavigation('/favorites')} style={{ cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faHeart} />
        <span>{t('tabBar.favorites')}</span>
      </div>
      <div className="tab-item" onClick={handleMyLocationClick} style={{ cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faCrosshairs} />
        <span>{t('tabBar.myLocation')}</span>
      </div>
    </div>
  );
};

export default TabBar;