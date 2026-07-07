import React, { useState, useEffect } from 'react';
import { useLoading } from '../contexts/LoadingContext';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';

const CACHE_KEY = 'rollinghall_events_cache';
const API_BASE_URLS = [
  process.env.REACT_APP_API_URL,
  'https://barzidorock.vercel.app',
].filter(Boolean);

const normalizeEvent = (event, index = 0) => {
  const title = typeof event?.title === 'string' && event.title.trim()
    ? event.title.trim()
    : 'Rolling Hall';
  const date = typeof event?.date === 'string' ? event.date.trim() : '';
  const image = typeof event?.image === 'string' && event.image.trim()
    ? event.image.trim()
    : `https://picsum.photos/400/300?random=${index + 1}`;
  const rawTicketUrl = typeof event?.ticketUrl === 'string' ? event.ticketUrl.trim() : '';
  const ticketUrl = rawTicketUrl.replace(/^`(.*)`$/, '$1').trim() || 'https://www.rollinghall.co.kr';

  return {
    ...event,
    id: event?.id ?? `rh-${index + 1}`,
    title,
    date,
    image,
    ticketUrl,
  };
};

const parseEventDate = (dateText) => {
  if (typeof dateText !== 'string' || !dateText.trim()) {
    return null;
  }

  const koreanMatch = dateText.match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일/);
  if (koreanMatch) {
    return new Date(Number(koreanMatch[1]), Number(koreanMatch[2]) - 1, Number(koreanMatch[3]));
  }

  const parsedDate = new Date(dateText);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const fetchRollingHallEvents = async () => {
  let lastError = null;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/api/rollinghall-events`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${baseUrl}`);
      }

      const data = await response.json();
      const rawEvents = Array.isArray(data?.events)
        ? data.events
        : Array.isArray(data)
          ? data
          : [];

      return rawEvents.map(normalizeEvent).filter(event => event.date);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to fetch Rolling Hall events.');
};

const TicketsPage = () => {
  const { t } = useTranslation();
  const { setLoading } = useLoading();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let isActive = true;
    setLoading(true);

    const loadEvents = async () => {
      const cachedEvents = sessionStorage.getItem(CACHE_KEY);
      if (cachedEvents) {
        setEvents(JSON.parse(cachedEvents));
      } else {
          try {
            const freshEvents = await fetchRollingHallEvents();
            if (isActive) {
              console.log('✅ Fetched fresh events from API:', freshEvents);
              setEvents(freshEvents);
              sessionStorage.setItem(CACHE_KEY, JSON.stringify(freshEvents));
            }
          } catch (err) {
            console.error('❌ 티켓 정보를 불러오지 못했습니다:', err);
          }
      }
      
      if (isActive) {
        setLoading(false);
      }
    };

    loadEvents();

    return () => {
      isActive = false;
    };
  }, [setLoading]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcomingEvents = (Array.isArray(events) ? events : [])
    .map((event, index) => normalizeEvent(event, index))
    .filter(event => {
      const eventDate = parseEventDate(event.date);
      return eventDate && eventDate >= today;
    });

  return (
    <div className="tickets-page-container">
      <div className="event-list">
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map(event => (
            <div className="event-card" key={event.id}>
              <img src={event.image} alt={event.title} className="event-image" />
              <div className="event-info">
                <h2 className="event-title">{event.title}</h2>
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