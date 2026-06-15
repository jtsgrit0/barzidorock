import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const OptionsPage = () => {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    fetch('/README.md') // Fetches from the public folder
      .then(response => response.text())
      .then(text => setMarkdown(text));
  }, []);

  return (
    <div style={{ padding: '20px', color: '#eee', backgroundColor: '#333', height: '100vh', overflowY: 'auto' }}>
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
};

export default OptionsPage;