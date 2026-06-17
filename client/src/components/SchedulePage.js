import React, { useState, useEffect, useCallback } from 'react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
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
    poster_image: '', // 이미지 데이터를 저장할 필드 추가
  });
  const [editingSchedule, setEditingSchedule] = useState(null); // 수정 중인 일정
  const [isEditing, setIsEditing] = useState(false); // 수정 모드 여부
  const { executeRecaptcha } = useGoogleRecaptcha();
  // Vercel(프로덕션)과 로컬 개발 환경의 API 주소 구분
  const API_BASE_URL = 'https://barzidorock-2akv.vercel.app';

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
  }, [fetchSchedules]);

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
    if (isEditing) {
      setEditingSchedule(prev => ({ ...prev, [name]: value }));
    } else {
      setNewEvent({ ...newEvent, [name]: value });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEditing) {
          setEditingSchedule(prev => ({ ...prev, poster_image: reader.result }));
        } else {
          setNewEvent(prev => ({ ...prev, poster_image: reader.result }));
        }
      };
      reader.readAsDataURL(file);
    } else {
      if (isEditing) {
        setEditingSchedule(prev => ({ ...prev, poster_image: '' }));
      } else {
        setNewEvent(prev => ({ ...prev, poster_image: '' }));
      }
    }
  };

  const handleAreaChange = (e) => {
    setSelectedArea(e.target.value);
  };

  const resetForm = () => {
    setNewEvent({
      venue_id: '',
      event_date: '',
      event_name: '',
      description: '',
      poster_image: '', // 이미지 데이터 초기화
    });
    setSelectedArea('');
    setEditingSchedule(null);
    setIsEditing(false);
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const dataToSubmit = isEditing ? editingSchedule : newEvent;

    if (!dataToSubmit.venue_id || !dataToSubmit.event_date || !dataToSubmit.event_name) {
      alert('공연장, 날짜/시간, 공연명은 필수 항목입니다.');
      return;
    }

    let token;
    // reCAPTCHA는 POST (생성) 요청에만 필요
    if (!isEditing) {
      try {
        if (!executeRecaptcha) {
          throw new Error('reCAPTCHA is still loading. Please wait a moment and try again.');
        }
        token = await executeRecaptcha('scheduleSubmit');
        console.log('reCAPTCHA token generated:', token);
      } catch (error) {
        console.error('Error executing reCAPTCHA on client side:', error);
        alert(`reCAPTCHA 실행 중 오류가 발생했습니다: ${error.message}. 잠시 후 다시 시도해주세요.`);
        return;
      }
    }

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing 
        ? `${API_BASE_URL}/api/schedules` 
        : `${API_BASE_URL}/api/schedules`;
      const body = isEditing 
        ? JSON.stringify(dataToSubmit) 
        : JSON.stringify({ ...dataToSubmit, captcha: token });

      console.log(`Sending ${method} to:`, url);
      console.log('Payload:', dataToSubmit);
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Network response was not ok');
      }

      const result = await response.json();
      console.log('Server success:', result);
      
      resetForm();
      await fetchSchedules();
      alert(isEditing ? '공연일정이 수정되었습니다!' : '공연일정이 저장되었습니다!');
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} schedule:`, error);
      alert(`${isEditing ? '수정' : '저장'}에 실패했습니다: ${error.message}`);
    }
  }, [executeRecaptcha, newEvent, editingSchedule, isEditing, fetchSchedules, API_BASE_URL]);

  const handleEditClick = (schedule) => {
    const venue = venues.find(v => v.id === schedule.venue_id);
    if (venue) {
      setSelectedArea(venue.area);
      setFilteredVenues(venues.filter(v => v.area === venue.area));
    }
    setEditingSchedule({
      id: schedule.id,
      venue_id: schedule.venue_id,
      event_date: schedule.event_date.substring(0, 16), // datetime-local 형식에 맞춤
      event_name: schedule.event_name,
      description: schedule.description,
      poster_image: schedule.poster_image, // 이미지 데이터 로드
    });
    setIsEditing(true);
  };

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('정말로 이 일정을 삭제하시겠습니까?')) {
      return;
    }
    try {
      console.log('Sending DELETE to:', `${API_BASE_URL}/api/schedules?id=${id}`);
      const response = await fetch(`${API_BASE_URL}/api/schedules?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Network response was not ok');
      }

      console.log('Server success: Schedule deleted');
      await fetchSchedules();
      alert('공연일정이 삭제되었습니다!');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert(`삭제에 실패했습니다: ${error.message}`);
    }
  }, [fetchSchedules, API_BASE_URL]);

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleScheduleClick = (venueId) => {
    const venue = venues.find(v => v.id === venueId);
    if (venue && venue.websiteUrl) {
      window.open(venue.websiteUrl, '_blank');
    } else {
      alert('등록된 홈페이지 정보가 없습니다.');
    }
  };


  const areas = [...new Set(venues.map(venue => venue.area).filter(Boolean))];
  const areaNames = {
    hongdae: '홍대',
    itaewon: '이태원',
  };

  return (
    <div className="schedule-page">
      <div className="schedule-form-container">
        <h2>{isEditing ? '공연일정 수정' : '새 공연일정 등록'}</h2>
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
            value={isEditing ? editingSchedule?.venue_id || '' : newEvent.venue_id}
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
            value={isEditing ? editingSchedule?.event_date || '' : newEvent.event_date}
            onChange={handleInputChange}
            required
          />
          <input
            type="text"
            name="event_name"
            placeholder="공연명 또는 아티스트"
            value={isEditing ? editingSchedule?.event_name || '' : newEvent.event_name}
            onChange={handleInputChange}
            required
          />
          <textarea
            name="description"
            placeholder="추가 정보 (선택 사항)"
            value={isEditing ? editingSchedule?.description || '' : newEvent.description}
            onChange={handleInputChange}
          />
          <input
            type="file"
            name="poster_image"
            accept="image/*"
            onChange={handleImageChange}
            className="poster-image-input"
          />
          { (isEditing && editingSchedule?.poster_image) || (!isEditing && newEvent.poster_image) ? (
            <div className="poster-image-preview">
              <img src={isEditing ? editingSchedule.poster_image : newEvent.poster_image} alt="Poster Preview" />
              <button type="button" onClick={() => {
                if (isEditing) {
                  setEditingSchedule(prev => ({ ...prev, poster_image: '' }));
                } else {
                  setNewEvent(prev => ({ ...prev, poster_image: '' }));
                }
              }}>이미지 제거</button>
            </div>
          ) : null }
          <div className="form-buttons">
            <button type="submit" className="save-button" disabled={!executeRecaptcha && !isEditing}>
              {isEditing ? '수정' : (!executeRecaptcha ? 'reCAPTCHA 로딩중...' : '저장')}
            </button>
            {isEditing && (
              <button type="button" onClick={handleCancelEdit} className="cancel-button">
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="schedule-list-container">
        <h2>등록된 공연일정</h2>
        <ul className="schedule-list">
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <li key={schedule.id} className="schedule-item">
                <div className="schedule-item-content" onClick={() => handleScheduleClick(schedule.venue_id)}>
                  <div className="schedule-item-header">
                    <strong>{schedule.venue_name}</strong> - <span>{schedule.event_name}</span>
                  </div>
                  <div className="schedule-item-body">
                    <span>{new Date(schedule.event_date).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')}</span>
                    {schedule.description && <p>{schedule.description}</p>}
                    {schedule.poster_image && (
                      <div className="schedule-item-poster">
                        <img src={schedule.poster_image} alt="Poster" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="schedule-item-actions">
                  <button onClick={() => handleEditClick(schedule)} className="edit-button">수정</button>
                  <button onClick={() => handleDelete(schedule.id)} className="delete-button">삭제</button>
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

export default function SchedulePageWithCaptcha({ language }) {
  return (
    <GoogleReCaptchaProvider
      reCaptchaKey="6LfFviEtAAAAADfPFhv2KPq3oPIADahPzOqeJ1OL"
      language="ko"
    >
      <SchedulePage language={language} />
    </GoogleReCaptchaProvider>
  );
}