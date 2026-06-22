import React from 'react';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked'; // marked 라이브러리 임포트

const OptionsPage = () => {
  const { t } = useTranslation();

  const optionsContent = t('optionsPage.content', '옵션 페이지 내용');
  const renderedContent = marked(optionsContent); // 마크다운을 HTML로 변환

  return (
    <div className="options-page-content">
      <h1>{t('optionsPage.title', '옵션')}</h1>
      <div className="markdown-content" dangerouslySetInnerHTML={{ __html: renderedContent }} />
    </div>
  );
};

export default OptionsPage;