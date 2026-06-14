import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotReadyPopup.css';

const NotReadyPopup = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/'); // 홈으로 이동
  };

  return (
    <div className="popup-overlay" onClick={handleClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <h2>아직 준비중입니다.</h2>
        <p>빠른 시일 내에 오픈하겠습니다.</p>
        <button onClick={handleClose}>닫기</button>
      </div>
    </div>
  );
};

export default NotReadyPopup;