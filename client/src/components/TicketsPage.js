import React, { useState, useEffect } from 'react';
import { useLoading } from '../contexts/LoadingContext';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';

const CACHE_KEY = 'rollinghall_events_cache';
// 어느 환경에서든 항상 프로덕션 API 서버만 사용 (모바일 호환성 위해)
const API_BASE_URLS = ['https://barzidorock.vercel.app'];

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
  console.log('🔍 API_BASE_URLS:', API_BASE_URLS);
  console.log('🔍 현재 호스트:', window.location.hostname);

  for (const baseUrl of API_BASE_URLS) {
    try {
      const fullUrl = `${baseUrl}/api/rollinghall-events`;
      console.log('🚀 API 요청 시도:', fullUrl);
      const response = await fetch(fullUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
        }
      });
      console.log('✅ API 응답 받음:', fullUrl, '상태코드:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${baseUrl}`);
      }

      const data = await response.json();
      console.log('📦 API 데이터:', data);
      const rawEvents = Array.isArray(data?.events)
        ? data.events
        : Array.isArray(data)
          ? data
          : [];

      return rawEvents.map(normalizeEvent).filter(event => event.date);
    } catch (error) {
      console.error('❌ API 요청 실패:', baseUrl, error.message);
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
    const startTime = Date.now();
    const MIN_LOADING_TIME = 1500; // 최소 1.5초 동안 스플래시 노출

    const loadEvents = async () => {
            // 캐시된 이벤트가 있더라도 일단 보여주고, 새 데이터 가져오기
            const cachedEvents = sessionStorage.getItem(CACHE_KEY);
            if (cachedEvents) {
              console.log('📦 캐시된 이벤트 사용:', JSON.parse(cachedEvents));
              setEvents(JSON.parse(cachedEvents));
            }
            
            // 항상 새로운 데이터 가져오기
            try {
              const freshEvents = await fetchRollingHallEvents();
              if (isActive) {
                console.log('✅ 새로운 이벤트 불러옴:', freshEvents);
                setEvents(freshEvents);
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(freshEvents));
              }
            } catch (err) {
              console.error('❌ 티켓 정보를 불러오지 못했습니다:', err);
              // API 요청 실패시 기본 더미 이벤트라도 보여주기
              const fallbackEvents = [
                {
                  id: 'fallback-1',
                  title: '롤링홀 공연 정보',
                  date: '2026년 10월 공연 준비중',
                  image: 'https://picsum.photos/400/300?random=99',
                  ticketUrl: 'https://www.rollinghall.co.kr'
                }
              ];
              if (isActive) {
                setEvents(fallbackEvents);
              }
            }
      
      // 최소 로딩 시간을 보장하도록 지연 후 로딩 종료
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);
      
      setTimeout(() => {
        if (isActive) {
          setLoading(false);
        }
      }, remainingTime);
    };

    loadEvents();

    return () => {
      isActive = false;
    };
  }, [setLoading]);

  // 모든 이벤트를 그대로 보여주도록 수정 (날짜 필터링 제거 - 모바일 호환성)
  const allEvents = (Array.isArray(events) ? events : [])
    .map((event, index) => normalizeEvent(event, index));
  
  console.log('🎯 최종 렌더링할 이벤트:', allEvents.length, '개');

  return (
    <div className="tickets-page-container">
      <div className="event-list">
        {allEvents.length > 0 ? (
          allEvents.map(event => (
            <div className="event-card" key={event.id}>
              <img src={event.image} alt={event.title} className="event-image" crossorigin="anonymous" loading="lazy" onError={(e) => console.error('이미지 로드 오류:', e, event.image)} />
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