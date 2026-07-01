import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import venuesData from '../venues.json';
import Tesseract from 'tesseract.js';
import './VenueManagerRegister.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || window.location.origin;

// area 영문명을 한국어 지역명으로 매핑 (컴포넌트 외부에서 한 번만 계산)
const areaToKorean = {
  'hongdae': '홍대',
  'gangnam': '강남',
  'itaewon': '이태원'
};

// venues.json에서 모든 공연장 데이터를 가져와 지역별로 분류 (컴포넌트 외부에서 한 번만 계산)
const processedVenues = venuesData.map(venue => {
  const region = areaToKorean[venue.area] || venue.area;
  return {
    id: venue.id,
    name: venue.name.ko, // 한국어 공연장 이름 사용
    region: region // area를 한국어 지역명으로 변환
  };
});

// 고유한 지역 목록 추출 (컴포넌트 외부에서 한 번만 계산)
const regions = [...new Set(processedVenues.map(venue => venue.region))];

const VenueManagerRegister = () => {
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
  
  const [selectedRegion, setSelectedRegion] = useState('');
  const [filteredVenues, setFilteredVenues] = useState([]);

  // 선택된 지역에 따라 공연장 목록 필터링 (selectedRegion이 변경될 때만 실행)
  useEffect(() => {
    if (selectedRegion) {
      const filtered = processedVenues.filter(venue => venue.region === selectedRegion);
      setFilteredVenues(filtered);
    } else {
      setFilteredVenues([]);
      setFormData(prev => ({ ...prev, venue_id: '' }));
    }
  }, [selectedRegion]);

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
        Tesseract.recognize(
          file,
          'kor', // 한국어 OCR
          { 
            logger: m => {},
            langPath: 'https://tessdata.projectnaptha.com/4.0.0'
          }
        ).then(({ data: { text } }) => {
    
          setFormData(prev => ({ ...prev, business_registration_text: text }));
        }).catch(err => {
          console.error('OCR 처리 오류:', err);
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
          const data = await response.json();
          throw new Error(data.error || '회원가입에 실패했습니다');
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
          <button onClick={() => window.location.href='/'} className="home-button">
            메인으로 돌아가기
          </button>
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
                <option key={region} value={region}>{region}</option>
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
    </div>
  );
};

export default VenueManagerRegister;