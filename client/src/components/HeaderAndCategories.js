import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HeaderAndCategories.css';
import { useTranslation } from 'react-i18next'; // useTranslation 훅 임포트

// translations prop 제거
function HeaderAndCategories({ selectedCategory, onCategoryChange, language, setLanguage }) {
  const { t } = useTranslation(); // t 함수 가져오기
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setMenuOpen(false);
  };

  const handleCategoryClick = (category) => {
    onCategoryChange(category);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const flags = {
    ko: '🇰🇷',
    en: '🇺🇸',
    zh: '🇨🇳',
    ja: '🇯🇵',
    fr: '🇫🇷', // 프랑스어 추가
  };

  const languageOptions = {
    ko: '한국어',
    en: 'English',
    zh: '中文',
    ja: '日本語',
    fr: 'Français', // 프랑스어 추가
  };

  return (
    <div className="floating-header">
      <div className="title-and-categories">
        <h1>
          <img src={`${process.env.PUBLIC_URL}/app_icon.png`} alt="app icon" className="header-app-icon" />
          BarZidoROCK
        </h1>
        <div className="categories">
          <button 
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => handleCategoryClick('all')}
          >
            {t('category_all', '전체')} {/* t 함수 사용 */}
          </button>
          <button 
            className={selectedCategory === 'hongdae' ? 'active' : ''}
            onClick={() => handleCategoryClick('hongdae')}
          >
            {t('category_hongdae', '홍대')} {/* t 함수 사용 */}
          </button>
          <button 
            className={selectedCategory === 'itaewon' ? 'active' : ''}
            onClick={() => handleCategoryClick('itaewon')}
          >
            {t('category_itaewon', '이태원')} {/* t 함수 사용 */}
          </button>
        </div>
      </div>
      <div className="language-switcher">
        <div className="languages desktop-languages">
          <span onClick={() => setLanguage('ko')} style={{ cursor: 'pointer', opacity: language === 'ko' ? 1 : 0.5 }}>{flags.ko}</span>
          <span onClick={() => setLanguage('en')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'en' ? 1 : 0.5 }}>{flags.en}</span>
          <span onClick={() => setLanguage('zh')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'zh' ? 1 : 0.5 }}>{flags.zh}</span>
          <span onClick={() => setLanguage('ja')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'ja' ? 1 : 0.5 }}>{flags.ja}</span>
          <span onClick={() => setLanguage('fr')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'fr' ? 1 : 0.5 }}>{flags.fr}</span> {/* 프랑스어 추가 */}
        </div>
        <div className="mobile-menu">
          <span className="current-flag" onClick={() => setMenuOpen(!menuOpen)}>
            {flags[language]}
          </span>
          {menuOpen && (
            <div className="menu-dropdown">
              {Object.keys(flags)
                .filter(lang => lang !== language)
                .map(lang => (
                  <div key={lang} onClick={() => handleLanguageChange(lang)}>
                    {flags[lang]} {languageOptions[lang]}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HeaderAndCategories;