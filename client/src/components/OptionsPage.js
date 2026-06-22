import React from 'react';
import { useTranslation } from 'react-i18next'; // useTranslation 훅 임포트

const OptionsPage = () => {
  const { t } = useTranslation(); // t 함수 가져오기

  return (
    <div className="options-page-container"> {/* 컨테이너 클래스 추가 */}
      <h1>{t('optionsPage.title', '옵션')}</h1> {/* 제목 번역 */}
      <p>{t('optionsPage.content', '옵션 페이지 내용')}</p> {/* 내용 번역 */}
    </div>
  );
};

export default OptionsPage;