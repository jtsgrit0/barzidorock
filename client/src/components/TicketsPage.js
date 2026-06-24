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
        const response = await fetch(`${apiUrl}/api/schedules`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setEvents(data); // API는 배열을 직접 반환하므로 data.events 대신 data 사용
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
  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.event_date);
    return eventDate >= new Date(); // 오늘 이후의 공연만 표시
  }).map(event => ({
    id: event.id,
    image: event.poster_image, // DB의 poster_image를 image로 매핑
    title: event.event_name, // DB의 event_name을 title로 매핑
    date: new Date(event.event_date).toLocaleDateString('ko-KR'), // event_date를 한국식 날짜로 변환
    ticketUrl: event.website_url || '#' // 티켓 URL이 있다면 사용
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