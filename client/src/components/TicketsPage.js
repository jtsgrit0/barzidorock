import React, { useState, useEffect } from 'react';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';

// 캐시 설정: 1시간(3600000ms) 동안 캐시 유지
const CACHE_KEY = 'rollinghall_events_cache';
const CACHE_EXPIRY = 3600000;

const TicketsPage = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      // 1. 먼저 캐시된 데이터가 있는지 확인
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        try {
          const { timestamp, data } = JSON.parse(cachedData);
          const now = new Date().getTime();
          
          // 캐시가 만료되지 않았으면 캐시된 데이터 먼저 사용
          if (now - timestamp < CACHE_EXPIRY) {
            setEvents(data.events);
            setLoading(false);
            // 백그라운드에서 최신 데이터 업데이트
            await refreshEvents();
            return;
          }
        } catch (e) {
          // 캐시 파싱 오류 시 무시하고 새로 불러옴
          console.warn('캐시 데이터 파싱 오류, 새로 불러옵니다:', e);
        }
      }

      // 캐시가 없거나 만료되었으면 새로 불러오기
      await refreshEvents();
    };

    const refreshEvents = async () => {
      try {
        let apiUrl = 'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app';
        const response = await fetch(`${apiUrl}/api/rollinghall-events`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // 새로 불러온 데이터를 상태에 저장
        setEvents(data.events);
        
        // localStorage에 캐시 저장 (타임스탬프와 함께)
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: new Date().getTime(),
          data: data
        }));
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return <div className="tickets-page-container">로딩 중...</div>;
  }

  if (error) {
    return <div className="tickets-page-container">에러: {error.message}</div>;
  }

  // 과거 날짜의 공연은 필터링하고, 필요한 필드명으로 매핑
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 오늘 날짜의 시간을 00:00으로 설정
  
  const upcomingEvents = events.filter(event => {
    // "2026년 07월 31일" 형식의 문자열을 Date 객체로 변환
    const dateMatch = event.date.match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일/);
    if (!dateMatch) return false;
    const eventDate = new Date(dateMatch[1], dateMatch[2] - 1, dateMatch[3]); // 월은 0부터 시작하므로 -1
    return eventDate >= today; // 오늘 이후의 공연만 표시
  }).map(event => ({
    id: event.id,
    image: event.image.replace(/^https:\/\/www.rollinghall.co.kr/, 'https://www.rollinghall.co.kr'), // 이미지 URL 정규화
    title: event.title,
    date: event.date,
    ticketUrl: event.ticketUrl.replace(/^`(.*)`$/, '$1') // 불필요한 백틱 제거
  }));

  return (
    <div className="tickets-page-container">

      <div className="event-list">
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map(event => (
            <div className="event-card" key={event.id}>
              <img src={event.image} alt={event.title} className="event-image" />
              <div className="event-info">
                <h2>{event.title}</h2>
                <p className="event-date">{event.date}</p>
                <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" className="ticket-button">
                  {t('ticketsPage.buyTickets', '예매하기')}
                </a>
              </div>
            </div>
          ))
        ) : (
          <p>{t('ticketsPage.noTicketsAvailable', '현재 예매 가능한 공연이 없습니다.')}</p>
        )}
      </div>
    </div>
  );
};

export default TicketsPage;