import React, { useState } from 'react';
import './HeaderAndCategories.css';

function HeaderAndCategories({ selectedCategory, onCategoryChange, language, setLanguage, translations }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setMenuOpen(false); // Close the menu after selection
  };

  const flags = {
    ko: '🇰🇷',
    en: '🇺🇸', // 미국 국기로 변경
    zh: '🇨🇳',
    ja: '🇯🇵',
  };

  const languageOptions = {
    ko: '한국어',
    en: 'English',
    zh: '中文',
    ja: '日本語',
  };

  return (
    <div className="floating-header">
      <div className="title-and-categories">
        <h1>BarZidoROCK</h1>
        <div className="categories">
          <button 
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => onCategoryChange('all')}
          >
            {translations.category_all || '전체'}
          </button>
          <button 
            className={selectedCategory === 'hongdae' ? 'active' : ''}
            onClick={() => onCategoryChange('hongdae')}
          >
            {translations.category_hongdae || '홍대'}
          </button>
          <button 
            className={selectedCategory === 'itaewon' ? 'active' : ''}
            onClick={() => onCategoryChange('itaewon')}
          >
            {translations.category_itaewon || '이태원'}
          </button>
        </div>
      </div>
      <div className="language-switcher">
        <div className="languages desktop-languages">
          <span onClick={() => setLanguage('ko')} style={{ cursor: 'pointer', opacity: language === 'ko' ? 1 : 0.5 }}>{flags.ko}</span>
          <span onClick={() => setLanguage('en')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'en' ? 1 : 0.5 }}>{flags.en}</span>
          <span onClick={() => setLanguage('zh')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'zh' ? 1 : 0.5 }}>{flags.zh}</span>
          <span onClick={() => setLanguage('ja')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'ja' ? 1 : 0.5 }}>{flags.ja}</span>
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