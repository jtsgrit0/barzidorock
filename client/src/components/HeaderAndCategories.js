import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { assetUrl } from '../utils/assetUrl';
import './HeaderAndCategories.css';
import { useTranslation } from 'react-i18next';

function HeaderAndCategories({ selectedCategory, onCategoryChange, language, setLanguage, venues, onSearch }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
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

  const handleSearchClick = () => {
    setSearchOpen(!searchOpen);
    if (searchOpen) {
      setSearchQuery('');
      if (onSearch) onSearch('');
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) onSearch(query);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (onSearch) onSearch(searchQuery, true);
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
    }
  };

  const flags = {
    ko: '🇰🇷',
    en: '🇺🇸',
    zh: '🇨🇳',
    ja: '🇯🇵',
    fr: '🇫🇷',
  };

  const languageOptions = {
    ko: '한국어',
    en: 'English',
    zh: '中文',
    ja: '日本語',
    fr: 'Français',
  };

  const categories = [
    { key: 'all', label: t('category_all', '전체') },
    { key: 'hongdae', label: t('category_hongdae', '홍대') },
    { key: 'itaewon', label: t('category_itaewon', '이태원') },
    { key: 'sukmyung', label: t('category_sukmyung', '숙명') },
    { key: 'sinchon', label: t('category_sinchon', '신촌') },
    { key: 'suwon', label: t('category_suwon', '수원') },
  ];

  return (
    <div className="floating-header">
      <div className="title-and-categories">
        <h1>
          <img src={`${assetUrl('app_icon_text.png')}?v=7`} alt="BarZidoROCK" className="header-app-icon" />
        </h1>
        <div className="region-dropdown">
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryClick(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="header-actions">
        {searchOpen && (
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder={t('search_placeholder', '공연장 검색...')}
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />
        )}
        <button className="search-button" onClick={handleSearchClick} title={t('search', '검색')}>
          {searchOpen ? '✕' : '🔍'}
        </button>
        <div className="language-switcher">
          <div className="languages desktop-languages">
            <span onClick={() => setLanguage('ko')} style={{ cursor: 'pointer', opacity: language === 'ko' ? 1 : 0.5 }}>{flags.ko}</span>
            <span onClick={() => setLanguage('en')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'en' ? 1 : 0.5 }}>{flags.en}</span>
            <span onClick={() => setLanguage('zh')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'zh' ? 1 : 0.5 }}>{flags.zh}</span>
            <span onClick={() => setLanguage('ja')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'ja' ? 1 : 0.5 }}>{flags.ja}</span>
            <span onClick={() => setLanguage('fr')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'fr' ? 1 : 0.5 }}>{flags.fr}</span>
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
    </div>
  );
}

export default HeaderAndCategories;