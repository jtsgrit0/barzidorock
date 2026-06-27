import React, { useState, useEffect } from 'react';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';

// 캐시 설정: 이제 캐시를 항상 강제로 삭제하므로 CACHE_EXPIRY 미사용
const CACHE_KEY = 'rollinghall_events_cache_v3';
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

// readCachedEvents 함수 삭제 - 캐시 로직 변경으로 미사용

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    // 페이지 로드시 무조건 모든 캐시 삭제 - 강제로 새 데이터 가져오기
    localStorage.removeItem('rollinghall_events_cache_v2');
    localStorage.removeItem(CACHE_KEY);
    // 혹시 모르는 모든 관련 캐시 키 삭제
    Object.keys(localStorage).forEach(key => {
      if (key.includes('rollinghall_events')) {
        localStorage.removeItem(key);
      }
    });

    const loadEvents = async () => {
      try {
        const freshEvents = await fetchRollingHallEvents();
        if (!isActive) return;
        
        console.log('✅ Fetched fresh events from API:', freshEvents);
        setEvents(freshEvents);
        // 새 데이터만 캐시에 저장
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: { events: freshEvents },
        }));
      } catch (err) {
        console.error('❌ 티켓 정보를 불러오지 못했습니다:', err);
        if (!isActive) return;
        setLoading(false);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadEvents();

    return () => {
      isActive = false;
    };
  }, []);

  if (loading) {
    return <div className="tickets-page-container">로딩 중...</div>;
  }

  // 과거 날짜의 공연은 필터링하고, 필요한 필드명으로 매핑
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 오늘 날짜의 시간을 00:00으로 설정
  
  // 디버깅: 모든 이벤트와 날짜 비교 로그 추가
  console.log('Today:', today);
  events.forEach((event, index) => {
    const eventDate = parseEventDate(event.date);
    console.log(`Event ${index + 1}: "${event.title}", date string: "${event.date}", parsed date:`, eventDate, 'is >= today?', eventDate && eventDate >= today);
  });

  const upcomingEvents = (Array.isArray(events) ? events : [])
    .map((event, index) => normalizeEvent(event, index))
    .filter(event => {
      const eventDate = parseEventDate(event.date);
      // 오늘 날짜인 공연도 포함하도록 = 추가
      const isUpcoming = eventDate && eventDate >= today;
      return isUpcoming;
    });
  console.log('Final upcoming events:', upcomingEvents);

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