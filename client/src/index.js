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

// 스플래시 화면 숨기기
const splash = document.getElementById('splash');
if (splash) {
  setTimeout(() => {
    splash.style.opacity = 0;
    setTimeout(() => {
      splash.style.display = 'none';
    }, 500); // 0.5초 후 완전히 숨김
  }, 1000); // 1초 후 사라지기 시작
}