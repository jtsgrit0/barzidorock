import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

const OptionsPage = () => {
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    fetch('/README.md') // Fetches from the public folder
      .then(response => response.text())
      .then(text => {
        setHtmlContent(marked(text));
      });
  }, []);

  return (
    <div 
      style={{ padding: '20px', color: '#eee', backgroundColor: '#333', height: '100vh', overflowY: 'auto' }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default OptionsPage;