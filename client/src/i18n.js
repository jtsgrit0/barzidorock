import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 번역 파일 임포트
import translationEN from './locales/en.json';
import translationKO from './locales/ko.json';
import translationJA from './locales/ja.json';
import translationZH from './locales/zh.json';
import translationFR from './locales/fr.json';

// 번역 리소스
const resources = {
  en: {
    translation: translationEN
  },
  ko: {
    translation: translationKO
  },
  ja: {
    translation: translationJA
  },
  zh: {
    translation: translationZH
  },
  fr: {
    translation: translationFR
  }
};

i18n
  .use(initReactI18next) // i18n을 react-i18next에 전달
  .init({
    resources,
    lng: 'ko', // 기본 언어 설정
    fallbackLng: 'en', // 번역을 찾을 수 없을 때 사용할 언어
    interpolation: {
      escapeValue: false // React는 이미 XSS로부터 안전함
    }
  });

export default i18n;