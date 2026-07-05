import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Tesseract from 'tesseract.js';
import { fetchVenues } from '../utils/fetchVenues';
import './VenueManagerRegister.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://barzidorock.vercel.app';

// area 영문명을 한국어 지역명으로 매핑
const areaToKorean = {
  'hongdae': '홍대',
  'itaewon': '이태원',
  'gangnam': '강남'
};

const VenueManagerRegister = () => {
  const [venues, setVenues] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false); // 회원가입 완료 여부
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    phone_number: '',
    venue_id: '',
    business_registration_file: null,
    business_registration_text: '' // OCR로 추출된 텍스트 저장
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false); // 팝업 표시 여부 상태
  const [popupMessage, setPopupMessage] = useState(''); // 팝업 메시지 상태
  
  const [selectedRegion, setSelectedRegion] = useState('');
  const [filteredVenues, setFilteredVenues] = useState([]);

  const [regions, setRegions] = useState([]);

  useEffect(() => {
    fetchVenues()
      .then(data => {
        console.log('VenueManagerRegister.jsx: venues loaded successfully:', data.length, 'venues');
        setVenues(data);
        const uniqueRegions = [...new Set(data.map(venue => venue.area).filter(area => area && area !== 'all'))];
        setRegions(uniqueRegions);
        if (uniqueRegions.length > 0) {
          setSelectedRegion(uniqueRegions[0]);
        }
      })
      .catch(error => console.error('VenueManagerRegister.jsx: Error fetching venues:', error));
  }, []);

  // 선택된 지역에 따라 공연장 목록 필터링
  useEffect(() => {
    if (selectedRegion && venues.length > 0) {
      const venuesInArea = venues.filter(venue => venue.area === selectedRegion);
      const mappedVenues = venuesInArea.map(venue => ({
        id: venue.id,
        name: venue.name.ko || venue.name
      }));
      setFilteredVenues(mappedVenues);
    } else {
      setFilteredVenues([]);
    }
    // 지역이 변경되면 선택된 공연장 초기화
    setFormData(prev => ({ ...prev, venue_id: '' }));
  }, [selectedRegion, venues]);

  // 지역 선택 핸들러
  const handleRegionChange = (e) => {
    setSelectedRegion(e.target.value);
  };

  // 입력값 변경 핸들러
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      const file = files[0];
      setFormData({ ...formData, [name]: file });
      
      // 사업자등록증 파일인 경우 OCR로 텍스트 추출
      if (name === 'business_registration_file') {
        // Tesseract.js v5 안정적인 설정: createWorker로 명시적 경로 지정
        (async () => {
          console.log('🏢 사업자등록증 OCR 처리 시작...');
          console.log('📦 createWorker 호출 전...');
           // 🚨 절대로 jsDelivr는 사용하지 않음! 공식 tessdata CDN만 사용 - 404 오류 완전 해결
            const worker = await Tesseract.createWorker('kor+eng', 1, {
              workerPath: 'https://unpkg.com/tesseract.js@5.0.4/dist/worker.min.js',
              corePath: 'https://unpkg.com/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
              langPath: 'https://tessdata.projectnaptha.com/4.0.0'
            });
          console.log('✅ worker 생성 성공!');
          // 이미지 전체 텍스트 제대로 읽도록 옵션 추가
          console.log('🔍 recognize 호출 전...');
          const { data: { text } } = await worker.recognize(file, {
            rotateText: true,
            preserveInterwordSpacing: true,
            tessedit_pageseg_mode: 6
          });
          console.log('✅ 텍스트 인식 완료! 추출된 텍스트 길이:', text.length);
          await worker.terminate();
          console.log('🏁 worker 종료 완료');
          setFormData(prev => ({ ...prev, business_registration_text: text }));
        })().catch(err => {
          console.error('❌ 사업자등록증 OCR 처리 오류:', err);
          console.error('오류 메시지:', err.message);
        });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // 모든 정보를 한번에 유효성 검사
  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = '이메일을 입력해주세요';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = '유효한 이메일 형식이 아닙니다';
    if (!formData.password) newErrors.password = '비밀번호를 입력해주세요';
    else if (formData.password.length < 8) newErrors.password = '비밀번호는 8자 이상이어야 합니다';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    if (!formData.phone_number) newErrors.phone_number = '전화번호를 입력해주세요';
    if (!formData.venue_id) newErrors.venue_id = '공연장을 선택해주세요';
    if (!formData.business_registration_file) newErrors.business_registration_file = '사업자등록증 파일을 업로드해주세요';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 최종 회원가입 제출
  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // 파일을 Base64로 변환
      const fileReader = new FileReader();
      fileReader.readAsDataURL(formData.business_registration_file);
      fileReader.onload = async () => {
        const base64File = fileReader.result;
        
        const response = await fetch(`${API_BASE_URL}/api/venue-managers/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            phone_number: formData.phone_number,
            venue_id: formData.venue_id,
            business_registration_file: base64File,
            business_registration_text: formData.business_registration_text
          })
        });

        if (!response.ok) {
          let message = '회원가입에 실패했습니다';
          if (response.status === 409) {
            message = '이미 가입된 이메일입니다.';
          } else {
            try {
              const data = await response.json();
              message = data.error || message;
            } catch {
              message = `서버 오류 (${response.status})`;
            }
          }
          setPopupMessage(message); // 팝업 메시지 설정
          setShowPopup(true); // 팝업 표시
          throw new Error(message);
        }
        
        setIsCompleted(true); // 회원가입 완료 상태로 변경
      };
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">

      
      {/* 회원가입 완료 메시지 */}
      {isCompleted ? (
        <div className="success-message">
          <h2>회원가입 신청이 완료되었습니다!</h2>
          <p>
            제출하신 정보를 검토한 후 관리자가 승인할 때까지 기다려주세요.<br/>
            승인이 완료되면 등록하신 이메일로 안내 메일이 발송됩니다.
          </p>
          <Link to="/" className="home-button">
            메인으로 돌아가기
          </Link>
        </div>
      ) : (
        /* 한 페이지에 모든 정보 입력 폼 */
        <form onSubmit={handleSubmitRegistration} className="register-form">
          <div className="form-group">
            <label>이메일</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="이메일을 입력해주세요"
            />
            {errors.email && <span className="error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호 (8자 이상)"
            />
            {errors.password && <span className="error">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label>비밀번호 확인</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력해주세요"
            />
            {errors.confirmPassword && <span className="error">{errors.confirmPassword}</span>}
          </div>

          <div className="form-group">
            <label>휴대폰 번호</label>
            <input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="'-' 없이 입력해주세요 (예: 01012345678)"
            />
            {errors.phone_number && <span className="error">{errors.phone_number}</span>}
          </div>

          <div className="form-group">
            <label>지역 선택</label>
            <select name="region" value={selectedRegion} onChange={handleRegionChange}>
              <option value="">지역을 선택해주세요</option>
              {regions.map(region => (
                <option key={region} value={region}>{areaToKorean[region]}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>공연장 선택</label>
            <select name="venue_id" value={formData.venue_id} onChange={handleChange} disabled={!selectedRegion}>
              <option value="">공연장을 선택해주세요</option>
              {filteredVenues.map(venue => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
            {errors.venue_id && <span className="error">{errors.venue_id}</span>}
          </div>



          <div className="form-group">
            <label>사업자등록증 업로드</label>
            <input
              type="file"
              name="business_registration_file"
              onChange={handleChange}
              accept=".pdf,.jpg,.jpeg,.png"
            />
            {errors.business_registration_file && <span className="error">{errors.business_registration_file}</span>}
            <p className="helper-text">
              사업자등록증 스캔본 또는 사진 파일(PDF, JPG, PNG)을 업로드해주세요.
              파일 용량은 10MB 이하여야 합니다.
            </p>
            {formData.business_registration_file && (
              <div className="file-info">
                선택된 파일: {formData.business_registration_file.name}
              </div>
            )}
          </div>

          {errors.general && <span className="error general">{errors.general}</span>}
          
      <button type="submit" className="submit-button" disabled={isLoading}>
        {isLoading ? '처리중...' : '회원가입 완료'}
      </button>
      <Link to="/forgot-password" className="forgot-password-link">
        비밀번호를 잊으셨나요?
      </Link>
    </form>
  )}

  {/* 팝업 UI */}
  {showPopup && (
    <div className="popup-overlay">
      <div className="popup-content">
        <h3>알림</h3>
        <p>{popupMessage}</p>
        <button onClick={() => setShowPopup(false)}>확인</button>
      </div>
    </div>
  )}
</div>
  );
};

export default VenueManagerRegister;