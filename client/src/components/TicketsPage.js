import React, { useState, useEffect } from 'react';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';

const TicketsPage = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        let apiUrl = 'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app';
        // 롤링홀에서 직접 공연 데이터를 스크래핑하는 API 호출
        const response = await fetch(`${apiUrl}/api/rollinghall-events`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setEvents(data.events); // /api/rollinghall-events는 { events: [...] } 구조로 반환
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