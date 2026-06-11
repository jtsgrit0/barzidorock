import React from 'react';
import './HeaderAndCategories.css';

function HeaderAndCategories({ onCategoryChange }) {
  return (
    <div className="floating-header">
      <h1>BarZidoROCK</h1>
      <div className="categories">
        <button onClick={() => onCategoryChange('all')}>전체</button>
        <button onClick={() => onCategoryChange('hongdae')}>홍대</button>
        <button onClick={() => onCategoryChange('itaewon')}>이태원</button>
      </div>
    </div>
  );
}

export default HeaderAndCategories;