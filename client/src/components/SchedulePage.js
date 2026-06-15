import React, { useState, useEffect } from 'react';
import './SchedulePage.css';
import venues from '../venues.json'; // 공연장 목록을 직접 import

const SchedulePage = ({ language }) => {
  const [schedules, setSchedules] = useState([]);
  const [newEvent, setNewEvent] = useState({
    venue_id: '',
    event_date: '',
    event_name: '',
    description: '',
  });

  // 페이지 로드 시 저장된 스케줄을 불러옵니다.
  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/schedules');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      // 다국어 지원을 위해 venue_name을 변환합니다.
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
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEvent({ ...newEvent, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEvent.venue_id || !newEvent.event_date || !newEvent.event_name) {
      alert('공연장, 날짜/시간, 공연명은 필수 항목입니다.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEvent),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // 성공적으로 저장 후, 입력 폼을 초기화하고 스케줄 목록을 다시 불러옵니다.
      setNewEvent({
        venue_id: '',
        event_date: '',
        event_name: '',
        description: '',
      });
      fetchSchedules();
      alert('공연일정이 저장되었습니다!');
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('저장에 실패했습니다.');
    }
  };

  return (
    <div className="schedule-page">
      <div className="schedule-form-container">
        <h2>새 공연일정 등록</h2>
        <form onSubmit={handleSubmit} className="schedule-form">
          <select
            name="venue_id"
            value={newEvent.venue_id}
            onChange={handleInputChange}
            required
          >
            <option value="">공연장을 선택하세요</option>
            {venues.map((venue) => (
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
          <button type="submit" className="save-button">
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