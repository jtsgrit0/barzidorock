import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n'; // i18n 설정 파일 임포트
import { I18nextProvider } from 'react-i18next'; // I18nextProvider 임포트
import i18n from './i18n'; // i18n 인스턴스 임포트

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}> {/* App 컴포넌트를 I18nextProvider로 감싸기 */}
      <App />
    </I18nextProvider>
  </React.StrictMode>
);

reportWebVitals();