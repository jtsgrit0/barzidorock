import React, { useState, useEffect } from 'react';
import venuesData from '../venues.json';
import './VenueManagerRegister.css';

const API_BASE_URL = 'https://barzidorock.vercel.app';

const VenueManagerRegister = () => {
  const [step, setStep] = useState(1); // 1: 기본정보 입력, 2: 이메일인증, 3: 사업자등록증 업로드, 4: 완료
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    phone_number: '',
    venue_id: '',
    business_registration_file: null
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // area 영문명을 한국어 지역명으로 매핑
  const areaToKorean = {
    'hongdae': '홍대',
    'gangnam': '강남',
    'itaewon': '이태원'
  };

  // venues.json에서 모든 공연장 데이터를 가져와 지역별로 분류
  const processedVenues = venuesData.map(venue => ({
    id: venue.id,
    name: venue.name.ko, // 한국어 공연장 이름 사용
    region: areaToKorean[venue.area] || venue.area // area를 한국어 지역명으로 변환
  }));

  // 고유한 지역 목록 추출
  const regions = [...new Set(processedVenues.map(venue => venue.region))];
  const [selectedRegion, setSelectedRegion] = useState('');
  const [filteredVenues, setFilteredVenues] = useState([]);

  // 선택된 지역에 따라 공연장 목록 필터링
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
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // 기본정보 유효성 검사
  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = '이메일을 입력해주세요';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = '유효한 이메일 형식이 아닙니다';
    if (!formData.password) newErrors.password = '비밀번호를 입력해주세요';
    else if (formData.password.length < 8) newErrors.password = '비밀번호는 8자 이상이어야 합니다';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    if (!formData.phone_number) newErrors.phone_number = '전화번호를 입력해주세요';
    if (!formData.venue_id) newErrors.venue_id = '공연장을 선택해주세요';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 1단계: 기본정보 제출 및 이메일 인증 코드 발송
  const handleSubmitStep1 = async (e) => {
    e.preventDefault();
    if (!validateStep1()) return;
    
    setIsLoading(true);
    try {
      // 이메일 인증 코드 발송 API 호출
      const response = await fetch(`${API_BASE_URL}/api/venue-managers/send-email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '인증 코드 발송에 실패했습니다');
      }
      
      setStep(2); // 이메일 인증 단계로 이동
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // 2단계: 이메일 인증 코드 확인
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    if (!verificationCode) {
      setErrors({ verificationCode: '인증 코드를 입력해주세요' });
      return;
    }
    if (verificationCode.length !== 6) {
      setErrors({ verificationCode: '6자리 인증 코드를 입력해주세요' });
      return;
    }

    setIsLoading(true);
    try {
      // 이메일 인증 확인 API 호출
      const response = await fetch(`${API_BASE_URL}/api/venue-managers/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: verificationCode
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '인증에 실패했습니다');
      }
      
      setStep(3); // 사업자등록증 업로드 단계로 이동
    } catch (error) {
      setErrors({ verificationCode: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // 3단계: 최종 회원가입 제출
  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    if (!formData.business_registration_file) {
      setErrors({ business_registration_file: '사업자등록증 파일을 업로드해주세요' });
      return;
    }

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
            business_registration_number: formData.business_registration_number,
            business_registration_file: base64File
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '회원가입에 실패했습니다');
        }
        
        setStep(4); // 완료 단계로 이동
      };
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h1>공연장 관리자 회원가입</h1>
      
      {/* 진행 단계 표시 */}
      <div className="step-indicator">
        <div className={`step ${step >= 1 ? 'active' : ''}`}>기본정보</div>
        <div className={`step ${step >= 2 ? 'active' : ''}`}>이메일인증</div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>서류업로드</div>
        <div className={`step ${step >= 4 ? 'active' : ''}`}>완료</div>
      </div>

      {/* 1단계: 기본정보 입력 */}
      {step === 1 && (
        <form onSubmit={handleSubmitStep1} className="register-form">
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

          {errors.general && <span className="error general">{errors.general}</span>}
          
          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? '처리중...' : '다음 단계로'}
          </button>
        </form>
      )}

      {/* 2단계: 이메일 인증 */}
      {step === 2 && (
        <form onSubmit={handleVerifyEmail} className="register-form">
          <div className="form-group">
            <label>인증 코드</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="전송받은 6자리 인증 코드를 입력해주세요"
              maxLength={6}
            />
            {errors.verificationCode && <span className="error">{errors.verificationCode}</span>}
            <p className="helper-text">
              입력하신 이메일({formData.email})로 인증 코드가 전송되었습니다.
              10분 내에 입력해주세요.
            </p>
          </div>

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? '인증중...' : '인증 확인'}
          </button>
        </form>
      )}

      {/* 3단계: 사업자등록증 업로드 */}
      {step === 3 && (
        <form onSubmit={handleSubmitRegistration} className="register-form">
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
        </form>
      )}

      {/* 4단계: 회원가입 완료 */}
      {step === 4 && (
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
      )}
    </div>
  );
};

export default VenueManagerRegister;