import React, { useState, useEffect, useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import './SchedulePage.css';
import venues from '../venues.json';

const SchedulePage = ({ language }) => {
  const [schedules, setSchedules] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [newEvent, setNewEvent] = useState({
    venue_id: '',
    event_date: '',
    event_name: '',
    description: '',
  });
  const { executeRecaptcha } = useGoogleReCaptcha();
  // GitHub Pages(프로덕션)와 로컬 개발 환경 구분
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://barzidorock.onrender.com';

  useEffect(() => {
    console.log('reCAPTCHA executeRecaptcha status:', executeRecaptcha ? 'ready' : 'not ready');
    console.log('Current API URL:', API_BASE_URL);
  }, [executeRecaptcha, API_BASE_URL]);

  const fetchSchedules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedules`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      const formattedData = data.map(item => {
        const venue = venues.find(v => v.id === item.venue_id);
        return {
          ...item,
          venue_name: venue ? (venue.name[language] || venue.name['en']) : 'Unknown Venue'
        };
      });
      setSchedules(formattedData);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  }, [language, API_BASE_URL]);

  useEffect(() => {
    fetchSchedules();
    // Render 서버가 잠들지 않게 10분마다 핑 전송
    const pingInterval = setInterval(() => {
      fetch(`${API_BASE_URL}/api/schedules`).catch(() => {});
    }, 10 * 60 * 1000); // 10분마다
    return () => clearInterval(pingInterval);
  }, [fetchSchedules, API_BASE_URL]);

  useEffect(() => {
    if (selectedArea) {
      const venuesInArea = venues.filter(venue => venue.area === selectedArea);
      setFilteredVenues(venuesInArea);
    } else {
      setFilteredVenues([]);
    }
    setNewEvent(prev => ({ ...prev, venue_id: '' }));
  }, [selectedArea]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEvent({ ...newEvent, [name]: value });
  };

  const handleAreaChange = (e) => {
    setSelectedArea(e.target.value);
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!executeRecaptcha) {
      console.log('reCAPTCHA is not ready yet. Cannot submit.');
      return;
    }

    if (!newEvent.venue_id || !newEvent.event_date || !newEvent.event_name) {
      alert('공연장, 날짜/시간, 공연명은 필수 항목입니다.');
      return;
    }

    let token;
    try {
      token = await executeRecaptcha('scheduleSubmit');
      console.log('reCAPTCHA token generated:', token); // 토큰 생성 성공 시 로그 추가
    } catch (error) {
      console.error('Error executing reCAPTCHA on client side:', error); // 클라이언트 측 오류 로깅
      alert('reCAPTCHA 실행 중 오류가 발생했습니다. 네트워크 연결을 확인하거나 다시 시도해주세요.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...newEvent, captcha: token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response was not ok');
      }

      setNewEvent({
        venue_id: '',
        event_date: '',
        event_name: '',
        description: '',
      });
      setSelectedArea('');
      fetchSchedules();
      alert('공연일정이 저장되었습니다!');
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert(`저장에 실패했습니다: ${error.message}`);
    }
  }, [executeRecaptcha, newEvent, fetchSchedules, API_BASE_URL]);


  const areas = [...new Set(venues.map(venue => venue.area).filter(Boolean))];
  const areaNames = {
    hongdae: '홍대',
    itaewon: '이태원',
  };

  return (
    <div className="schedule-page">
      <div className="schedule-form-container">
        <h2>새 공연일정 등록</h2>
        <form onSubmit={handleSubmit} className="schedule-form">
          <select
            name="area"
            value={selectedArea}
            onChange={handleAreaChange}
            required
          >
            <option value="">지역을 먼저 선택하세요</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {areaNames[area] || area}
              </option>
            ))}
          </select>
          <select
            name="venue_id"
            value={newEvent.venue_id}
            onChange={handleInputChange}
            required
            disabled={!selectedArea}
          >
            <option value="">공연장을 선택하세요</option>
            {filteredVenues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name[language] || venue.name['en']}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            name="event_date"
            value={newEvent.event_date}
            onChange={handleInputChange}
            required
          />
          <input
            type="text"
            name="event_name"
            placeholder="공연명 또는 아티스트"
            value={newEvent.event_name}
            onChange={handleInputChange}
            required
          />
          <textarea
            name="description"
            placeholder="추가 정보 (선택 사항)"
            value={newEvent.description}
            onChange={handleInputChange}
          />
          <button type="submit" className="save-button" disabled={!executeRecaptcha}>
            저장
          </button>
        </form>
      </div>

      <div className="schedule-list-container">
        <h2>등록된 공연일정</h2>
        <ul className="schedule-list">
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <li key={schedule.id} className="schedule-item">
                <div className="schedule-item-header">
                  <strong>{schedule.venue_name}</strong> - <span>{schedule.event_name}</span>
                </div>
                <div className="schedule-item-body">
                  <span>{new Date(schedule.event_date).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')}</span>
                  {schedule.description && <p>{schedule.description}</p>}
                </div>
              </li>
            ))
          ) : (
            <p>등록된 공연일정이 없습니다.</p>
          )}
        </ul>
      </div>
    </div>
  );
};

export default SchedulePage;