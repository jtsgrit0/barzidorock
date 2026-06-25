import React, { useState, useEffect } from 'react';
import venuesData from '../venues.json';
import './VenueManagerRegister.css';

const API_BASE_URL = 'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app';

const VenueManagerRegister = () => {
  const [isCompleted, setIsCompleted] = useState(false); // 회원가입 완료 여부
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    phone_number: '',
    venue_id: '',
    business_registration_file: null,
    business_registration_number: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // area 영문명을 한국어 지역명으로 매핑
  const areaToKorean = {
    'hongdae': '홍대',
    'gangnam': '강남',
    'itaewon': '이태원'
  };

  // venues.json에서 모든 공연장 데이터를 가져와 지역별로 분류
  const processedVenues = venuesData.map(venue => {
    const region = areaToKorean[venue.area] || venue.area;
    console.log(`Venue: ${venue.name.ko}, area: ${venue.area}, region: ${region}`);
    return {
      id: venue.id,
      name: venue.name.ko, // 한국어 공연장 이름 사용
      region: region // area를 한국어 지역명으로 변환
    };
  });

  // 고유한 지역 목록 추출
  const regions = [...new Set(processedVenues.map(venue => venue.region))];
  console.log('최종 지역 목록:', regions);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [filteredVenues, setFilteredVenues] = useState([]);

  // 선택된 지역에 따라 공연장 목록 필터링
  useEffect(() => {
    console.log('processedVenues:', processedVenues);
    console.log('selectedRegion:', selectedRegion);
    if (selectedRegion) {
      const filtered = processedVenues.filter(venue => venue.region === selectedRegion);
      console.log('filteredVenues:', filtered);
      setFilteredVenues(filtered);
    } else {
      setFilteredVenues([]);
      setFormData(prev => ({ ...prev, venue_id: '' }));
    }
  }, [selectedRegion, processedVenues]);

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
    if (!formData.business_registration_number) newErrors.business_registration_number = '사업자등록번호를 입력해주세요';
    
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
            business_registration_number: formData.business_registration_number,
            business_registration_file: base64File
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
      <h1>공연장 관리자 회원가입</h1>
      
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
            <label>사업자등록번호</label>
            <input
              type="text"
              name="business_registration_number"
              value={formData.business_registration_number}
              onChange={handleChange}
              placeholder="'-' 없이 입력해주세요 (예: 1234567890)"
            />
            {errors.business_registration_number && <span className="error">{errors.business_registration_number}</span>}
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
        </form>
      )}
    </div>
  );
};

export default VenueManagerRegister;