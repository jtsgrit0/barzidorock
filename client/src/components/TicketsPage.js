import React from 'react';
import './TicketsPage.css';
import { useTranslation } from 'react-i18next';
import venuesData from '../venues.json'; // venues.json 데이터를 임포트합니다.

const TicketsPage = () => {
  const { t } = useTranslation();

  // ticketUrl을 가진 공연장만 필터링합니다.
  const venuesWithTickets = venuesData.filter(venue => venue.ticketUrl);

  return (
    <div className="tickets-page-container">
      <h1>{t('ticketsPage.title', '티켓 예매')}</h1>
      <p>{t('ticketsPage.description', '현재 예매 가능한 공연장 목록입니다. 각 공연장의 예매 페이지로 연결됩니다.')}</p>

      <div className="event-list">
        {venuesWithTickets.length > 0 ? (
          venuesWithTickets.map(venue => (
            <div className="event-item" key={venue.id}>
              <h2>{venue.name[t('language')] || venue.name.ko}</h2>
              <p>{t('ticketsPage.venueDescription', '온라인 예매 페이지로 이동합니다.')}</p>
              <a href={venue.ticketUrl} target="_blank" rel="noopener noreferrer" className="ticket-button">
                {t('ticketsPage.buyTickets', '예매하기')}
              </a>
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