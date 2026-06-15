import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

const OptionsPage = () => {
  const [htmlContent, setHtmlContent] = useState('Loading...');

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/README.md`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.text();
      })
      .then(text => {
        setHtmlContent(marked(text));
      })
      .catch(error => {
        console.error('Error fetching README.md:', error);
        setHtmlContent(`<p>Error loading content: ${error.message}</p>`);
      });
  }, []);

  return (
    <div
      className="options-page-content"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default OptionsPage;