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
        let apiUrl = 'https://barzidorock-1lax8hw6x-jtsgrit0s-projects.vercel.app';
        const response = await fetch(`${apiUrl}/api/schedules`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setEvents(data.events); // data.events로 수정
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