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
        let apiUrl = '';
        if (process.env.NODE_ENV === 'production') {
          if (window.location.hostname === 'jtsgrit0.github.io') {
            apiUrl = 'https://barzidorock-2akv.vercel.app';
          } else {
            apiUrl = '';
          }
        } else {
          apiUrl = 'http://localhost:5000';
        }
        const response = await fetch(`${apiUrl}/api/rollinghall-events`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setEvents(data);
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

  return (
    <div className="tickets-page-container">
      <h1>{t('ticketsPage.title', '티켓 예매')}</h1>
      <p>{t('ticketsPage.description', '현재 예매 가능한 공연 목록입니다. 각 공연의 예매 페이지로 연결됩니다.')}</p>

      <div className="event-list">
        {events.length > 0 ? (
          events.map(event => (
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