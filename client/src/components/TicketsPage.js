import React, { useState, useEffect } from 'react';
import { useLoading } from '../contexts/LoadingContext';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';

const CACHE_KEY = 'rollinghall_events_cache';
// 어느 환경에서든 항상 프로덕션 API 서버만 사용 (모바일 호환성 위해) - 절대 백틱 없음!
const API_BASE_URLS = ["https://barzidorock.vercel.app"];

// 모든 문자열 필드에서 백틱을 철저히 제거하는 전역 유틸리티 함수
const cleanStr = (str) => {
  if (typeof str !== 'string') return str;
  // 백틱을 두 번 제거해서 어떤 경우에도 남지 않도록
  return str.replace(/`/g, '').replace(/`/g, '').trim();
};

const normalizeEvent = (event, index = 0) => {

  const title = cleanStr(event?.title) || 'Rolling Hall';
  const date = cleanStr(event?.date) || '';
  const rawImage = cleanStr(event?.image) || 'https://picsum.photos/400/300?random=' + (index + 1);
  const cleanImage = cleanStr(rawImage); // 한번 더 제거
  const rawTicketUrl = cleanStr(event?.ticketUrl) || '';
  const cleanTicketUrl = cleanStr(rawTicketUrl);
  const ticketUrl = cleanTicketUrl || 'https://www.rollinghall.co.kr';

  return {
    ...event,
    id: event?.id ?? 'rh-' + (index + 1),
    title,
    date,
    image: cleanImage,
    ticketUrl,
  };
};

const fetchRollingHallEvents = async () => {
  let lastError = null;
  // API_BASE_URLS를 완전히 클린하게 만들어서 사용 (어떤 불순물도 제거)
  const cleanApiUrls = API_BASE_URLS.map(url => cleanStr(url));
  console.log('🔍 API_BASE_URLS:', cleanApiUrls);
  console.log('🔍 현재 호스트:', window.location.hostname);

  for (const baseUrl of cleanApiUrls) {
    try {
      // baseUrl에서 절대 백틱이 남지 않도록 마지막으로 클리닝
      const finalBaseUrl = cleanStr(baseUrl);
      const fullUrl = finalBaseUrl + '/api/rollinghall-events';
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
        throw new Error('HTTP ' + response.status + ' from ' + baseUrl);
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

  // 날짜 문자열을 Date 객체로 파싱하는 함수 (다양한 한글 날짜 형식 지원)
  const parseEventDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    // 다양한 한글 날짜 형식 파싱: "2026년 10월 15일", "2026.10.15", "2026. 09. 05", "2026-10-15" 등
    const koreanMatch = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (koreanMatch) {
      const year = parseInt(koreanMatch[1], 10);
      const month = parseInt(koreanMatch[2], 10) - 1; // JavaScript Date는 0부터 시작
      const day = parseInt(koreanMatch[3], 10);
      return new Date(year, month, day);
    }
    
    // 점으로 구분된 형식: "2026.10.15" 또는 "2026. 09. 05"
    const dotMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    if (dotMatch) {
      const year = parseInt(dotMatch[1], 10);
      const month = parseInt(dotMatch[2], 10) - 1;
      const day = parseInt(dotMatch[3], 10);
      return new Date(year, month, day);
    }
    
    // 대시로 구분된 형식: "2026-10-15" 또는 "2026- 10- 15"
    const dashMatch = dateStr.match(/(\d{4})-\s*(\d{1,2})-\s*(\d{1,2})/);
    if (dashMatch) {
      const year = parseInt(dashMatch[1], 10);
      const month = parseInt(dashMatch[2], 10) - 1;
      const day = parseInt(dashMatch[3], 10);
      return new Date(year, month, day);
    }
    
    return null;
  };

  // 오늘 날짜 (시간을 00:00으로 설정해서 당일 공연도 포함)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 모든 이벤트를 정규화한 후, 오늘 이후의 공연만 필터링
  const allEvents = (Array.isArray(events) ? events : [])
    .map((event, index) => normalizeEvent(event, index))
    .filter(event => {
      const eventDate = parseEventDate(event.date);
      // 날짜를 파싱할 수 없는 경우도 일단 보여주기 (안전장치)
      if (!eventDate) {
        console.log('⚠️ 날짜 파싱 실패, 표시함:', event.title, event.date);
        return true;
      }
      // 오늘 이후의 공연만 표시
      const isFutureOrToday = eventDate >= today;
      if (!isFutureOrToday) {
        console.log('⏮️ 지난 공연 제외:', event.title, event.date);
      }
      return isFutureOrToday;
    })
    .sort((a, b) => {
      const dateA = parseEventDate(a.date);
      const dateB = parseEventDate(b.date);
      // 오름차순: 가장 빠른 날짜가 위에 오도록 (빠른 날짜 → 늦은 날짜 순)
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB;
    });
  
  console.log('🎯 최종 렌더링할 이벤트:', allEvents.length, '개');

  const handleImageError = (e, imageUrl) => {
    console.error('이미지 로드 오류:', e, imageUrl);
    e.target.src = 'https://picsum.photos/400/300?random=' + Math.random();
  };

  return (
    <div className="tickets-page-container">
      <div className="events-grid">
        {allEvents.map((event) => (
          <div key={event.id} className="event-card">
            <div className="event-image-container">
              <img 
                src={event.image} 
                alt={event.title}
                className="event-image"
                onError={(e) => handleImageError(e, event.image)}
              />
            </div>
            <div className="event-info">
              <h3 className="event-title">{event.title}</h3>
              <p className="event-date">{event.date}</p>
              <a 
                href={event.ticketUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ticket-button"
              >
                {t('tickets.bookNow', '예매하기')}
              </a>
            </div>
          </div>
        ))}
      </div>
      
      {allEvents.length === 0 && (
        <div className="no-events-container">
          <p className="no-events-text">{t('tickets.noEvents', '현재 예매 가능한 공연이 없습니다')}</p>
        </div>
      )}
    </div>
  );
};

export default TicketsPage;