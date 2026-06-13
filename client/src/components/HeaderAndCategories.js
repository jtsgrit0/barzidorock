import React from 'react';
import './HeaderAndCategories.css';

function HeaderAndCategories({ selectedCategory, onCategoryChange }) {
  return (
    <div className="floating-header">
      <h1>BarZidoROCK</h1>
      <div className="categories">
        <button 
          className={selectedCategory === 'all' ? 'active' : ''}
          onClick={() => onCategoryChange('all')}
        >
          전체
        </button>
        <button 
          className={selectedCategory === 'hongdae' ? 'active' : ''}
          onClick={() => onCategoryChange('hongdae')}
        >
          홍대
        </button>
        <button 
          className={selectedCategory === 'itaewon' ? 'active' : ''}
          onClick={() => onCategoryChange('itaewon')}
        >
          이태원
        </button>
      </div>
    </div>
  );
}

export default HeaderAndCategories;