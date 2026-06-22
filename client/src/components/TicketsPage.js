import React from 'react';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';

// 롤링홀의 개별 공연 정적 데이터 (실제 스크래핑 데이터로 향후 교체 가능)
const rollingHallEvents = [
  {
    id: 'rh-001',
    titleKey: 'ticketsPage.event.rh-001.title', // 번역 키로 변경
    dateKey: 'ticketsPage.event.rh-001.date',   // 번역 키로 변경
    image: 'https://picsum.photos/400/300?random=1', // 실제 공연 이미지로 교체
    ticketUrl: 'https://www.rollinghall.co.kr/ticket/001'
  },
  {
    id: 'rh-002',
    titleKey: 'ticketsPage.event.rh-002.title', // 번역 키로 변경
    dateKey: 'ticketsPage.event.rh-002.date',   // 번역 키로 변경
    image: 'https://picsum.photos/400/300?random=2', // 실제 공연 이미지로 교체
    ticketUrl: 'https://www.rollinghall.co.kr/ticket/002'
  },
  {
    id: 'rh-003',
    titleKey: 'ticketsPage.event.rh-003.title', // 번역 키로 변경
    dateKey: 'ticketsPage.event.rh-003.date',   // 번역 키로 변경
    image: 'https://picsum.photos/400/300?random=3', // 실제 공연 이미지로 교체
    ticketUrl: 'https://www.rollinghall.co.kr/ticket/003'
  }
];

const TicketsPage = () => {
  const { t } = useTranslation();

  return (
    <div className="tickets-page-container">
      <h1>{t('ticketsPage.title', '티켓 예매')}</h1>
      <p>{t('ticketsPage.description', '현재 예매 가능한 공연 목록입니다. 각 공연의 예매 페이지로 연결됩니다.')}</p>

      <div className="event-list">
        {rollingHallEvents.length > 0 ? (
          rollingHallEvents.map(event => (
            <div className="event-card" key={event.id}>
              <img src={event.image} alt={t(event.titleKey)} className="event-image" /> {/* 번역 키 사용 */}
              <div className="event-info">
                <h2>{t(event.titleKey)}</h2> {/* 번역 키 사용 */}
                <p className="event-date">{t(event.dateKey)}</p> {/* 번역 키 사용 */}
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