import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import './HeaderAndCategories.css';

function HeaderAndCategories({ selectedCategory, onCategoryChange, language, setLanguage, translations }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setMenuOpen(false); // Close the menu after selection
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
      <div className="languages desktop-languages">
        <span onClick={() => setLanguage('ko')} style={{ cursor: 'pointer', opacity: language === 'ko' ? 1 : 0.5 }}>🇰🇷</span>
        <span onClick={() => setLanguage('en')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'en' ? 1 : 0.5 }}>🇬🇧</span>
        <span onClick={() => setLanguage('zh')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'zh' ? 1 : 0.5 }}>🇨🇳</span>
        <span onClick={() => setLanguage('ja')} style={{ cursor: 'pointer', marginLeft: '10px', opacity: language === 'ja' ? 1 : 0.5 }}>🇯🇵</span>
      </div>
      <div className="mobile-menu">
        <FontAwesomeIcon icon={faBars} onClick={() => setMenuOpen(!menuOpen)} />
        {menuOpen && (
          <div className="menu-dropdown">
            <div onClick={() => handleLanguageChange('ko')} style={{ opacity: language === 'ko' ? 1 : 0.7 }}>🇰🇷 한국어</div>
            <div onClick={() => handleLanguageChange('en')} style={{ opacity: language === 'en' ? 1 : 0.7 }}>🇬🇧 English</div>
            <div onClick={() => handleLanguageChange('zh')} style={{ opacity: language === 'zh' ? 1 : 0.7 }}>🇨🇳 中文</div>
            <div onClick={() => handleLanguageChange('ja')} style={{ opacity: language === 'ja' ? 1 : 0.7 }}>🇯🇵 日本語</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HeaderAndCategories;