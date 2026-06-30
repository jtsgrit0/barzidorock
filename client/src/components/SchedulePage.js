import React, { useState, useEffect, useCallback } from 'react';
import Tesseract from 'tesseract.js';


import './SchedulePage.css';
import venues from '../venues.json';
import fallbackSchedules from '../schedulesFallback.json';

const SchedulePage = ({ language }) => {
  const [schedules, setSchedules] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 로그인 상태 관리
  const [adminToken, setAdminToken] = useState(null); // 관리자 토큰 상태
  const [loginEmail, setLoginEmail] = useState(''); // 로그인 이메일
  const [loginPassword, setLoginPassword] = useState(''); // 로그인 비밀번호
  const [loginError, setLoginError] = useState(''); // 로그인 에러 메시지
  // 승인 대기 공연장 관리자 목록 상태
  const [pendingManagers, setPendingManagers] = useState([]);
  const [pendingManagersError, setPendingManagersError] = useState('');
  const [showPendingList, setShowPendingList] = useState(false);
  const [selectedArea, setSelectedArea] = useState('');
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [newEvent, setNewEvent] = useState({
    venue_id: '',
    event_name: '',
    description: '',
    poster_image: '',
  });
  const [editingSchedule, setEditingSchedule] = useState(null); // 수정 중인 일정
  const [isEditing, setIsEditing] = useState(false); // 수정 모드 여부
  const [isProcessingOCR, setIsProcessingOCR] = useState(false); // OCR 처리 중 상태

  // Load form state from session storage on component mount
  useEffect(() => {
    try {
      const savedFormState = sessionStorage.getItem('scheduleFormState');
      if (savedFormState) {
        const { newEvent: savedNewEvent, editingSchedule: savedEditingSchedule, isEditing: savedIsEditing, selectedArea: savedSelectedArea } = JSON.parse(savedFormState);
        if (savedNewEvent) setNewEvent(savedNewEvent);
        if (savedEditingSchedule) setEditingSchedule(savedEditingSchedule);
        if (savedIsEditing) setIsEditing(savedIsEditing);
        if (savedSelectedArea) setSelectedArea(savedSelectedArea);
      }
    } catch (error) {
      console.error("Failed to parse schedule form state from session storage:", error);
      sessionStorage.removeItem('scheduleFormState');
    }
  }, []); // Run only once on mount

  // Save form state to session storage whenever it changes
  useEffect(() => {
    const stateToSave = {
      newEvent: { ...newEvent, poster_image: '' }, // 이미지 데이터 제외
      editingSchedule: editingSchedule ? { ...editingSchedule, poster_image: '' } : null, // 이미지 데이터 제외
      isEditing,
      selectedArea
    };
    try {
      sessionStorage.setItem('scheduleFormState', JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Could not save form state to session storage:", error);
    }
  }, [newEvent, editingSchedule, isEditing, selectedArea]);

  // Vercel(프로덕션)과 로컬 개발 환경의 API 주소 구분
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://barzidorock.vercel.app';
  const formatScheduleRows = useCallback((scheduleData) => {
    return scheduleData.map(item => {
      const venue = venues.find(v => v.id === item.venue_id);
      // DB에 저장된 UTC 시간을 한국 시간(KST, UTC+9)으로 변환해서 화면에 표시
      const utcDate = new Date(item.event_date);
      const formattedDate = utcDate.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul'
      });
      return {
        ...item,
        venue_name: venue ? (venue.name[language] || venue.name['en']) : 'Unknown Venue',
        korean_event_date: formattedDate
      };
    }).sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
  }, [language]);

  useEffect(() => {
    // 페이지 로드 시 로컬스토리지에서 로그인 상태와 토큰 복원
    const savedLoginState = localStorage.getItem('isAdminLoggedIn');
    const savedToken = localStorage.getItem('adminToken');
    if (savedLoginState === 'true' && savedToken) {
      setIsLoggedIn(true);
      setAdminToken(savedToken);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    const cachedSchedules = sessionStorage.getItem('schedules');
    if (cachedSchedules) {
      setSchedules(JSON.parse(cachedSchedules));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/schedules`, { cache: 'no-cache' });
      const data = response.ok ? await response.json() : fallbackSchedules;
      const scheduleData = Array.isArray(data) && data.length > 0 ? data : fallbackSchedules;
      const formattedSchedules = formatScheduleRows(scheduleData);
      setSchedules(formattedSchedules);
      sessionStorage.setItem('schedules', JSON.stringify(formattedSchedules));
    } catch {
      const formattedSchedules = formatScheduleRows(fallbackSchedules);
      setSchedules(formattedSchedules);
      sessionStorage.setItem('schedules', JSON.stringify(formattedSchedules));
    }
  }, [API_BASE_URL, formatScheduleRows]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // 공연장 데이터를 한번만 처리하도록 useMemo 사용
  const processedVenues = React.useMemo(() => venues, []);
  
  useEffect(() => {
    if (selectedArea) {
      const venuesInArea = processedVenues.filter(venue => venue.area === selectedArea);
      setFilteredVenues(venuesInArea);
    } else {
      setFilteredVenues([]);
    }
    setNewEvent(prev => ({ ...prev, venue_id: '' }));
  }, [selectedArea, processedVenues]);



  const [selectedFile, setSelectedFile] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 파일 크기 제한: 10MB 이상이면 경고 표시
      if (file.size > 10 * 1024 * 1024) {
        alert('이미지 파일 크기가 너무 큽니다. 10MB 이하의 이미지를 사용해주세요.');
        return;
      }

      setSelectedFile(file); // 파일 객체 저장
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result;
        // 먼저 이미지만 상태에 업데이트 (OCR은 별도로 비동기 처리)
        const currentIsEditing = isEditing; // 현재 isEditing 상태를 클로저에 캡처
        if (currentIsEditing) {
          setEditingSchedule(prev => ({ ...prev, poster_image: imageData }));
        } else {
          setNewEvent(prev => ({ ...prev, poster_image: imageData }));
        }

        // OCR 작업 시작 전 로딩 상태 활성화
        setIsProcessingOCR(true);
        
        // OCR 작업을 setTimeout으로 비동기 큐에 넣어 메인 스레드 블로킹 방지
        setTimeout(async () => {
          try {
            console.log('OCR 처리 시작...');
            const { data: { text } } = await Tesseract.recognize(
              imageData,
              'kor+eng',
              {
                logger: m => console.log('[Tesseract]', m)
              }
            );

            console.log('OCR 추출 텍스트:', text);

            let parsedDate = '';
            let parsedEventName = '';
            let parsedDescription = '';

            // More robust regex to find dates like YYYY.MM.DD, YYYY-MM-DD, YYYY MM DD
            const robustDateRegex = /(\d{4})[.\s-년월일\s]*(\d{1,2})[.\s-년월일\s]*(\d{1,2})/;
            const match = text.match(robustDateRegex);
            if (match) {
              const year = match[1];
              const month = match[2].padStart(2, '0');
              const day = match[3].padStart(2, '0');
              parsedDate = `${year}-${month}-${day}T20:00`;
            }

            const lines = text.split('\n').filter(line => line.trim().length > 5);
            if (lines.length > 0) {
              parsedEventName = lines[0].trim().substring(0, 100);
            }
            if (lines.length > 1) {
              parsedDescription = lines.slice(1).join(' ').trim().substring(0, 500);
            }

            // 상태 업데이트 전에 현재 isEditing 값을 클로저에서 안전하게 사용
            const currentlyEditing = isEditing;
            // OCR이 완료된 후에만 상태 업데이트
            if (parsedDate || parsedEventName) {
              if (currentlyEditing) {
                setEditingSchedule(prev => ({
                  ...prev,
                  ...(parsedDate && { event_date: parsedDate }),
                  ...(parsedEventName && { event_name: parsedEventName }),
                  ...(parsedDescription && { description: parsedDescription })
                }));
              } else {
                setNewEvent(prev => ({
                  ...prev,
                  ...(parsedDate && { event_date: parsedDate }),
                  ...(parsedEventName && { event_name: parsedEventName }),
                  ...(parsedDescription && { description: parsedDescription })
                }));
              }
              alert('이미지에서 텍스트를 추출하여 자동으로 입력했습니다!');
            } else {
              alert('이미지는 업로드되었지만, 텍스트 추출에 실패했습니다. 직접 입력해주세요.');
            }
          } catch (error) {
            console.error('OCR 처리 중 오류:', error);
            alert('OCR 처리 중 오류가 발생했습니다. 직접 입력해주세요. 오류: ' + error.message);
          } finally {
            // OCR 처리 완료 후 로딩 상태 해제
            setIsProcessingOCR(false);
          }
        }, 0);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      if (isEditing) {
        setEditingSchedule(prev => ({ ...prev, poster_image: '' }));
      } else {
        setNewEvent(prev => ({ ...prev, poster_image: '' }));
      }
    }
  };

  const handleAreaChange = (e) => {
    setSelectedArea(e.target.value);
  };

  const resetForm = () => {
    // Clear form state from session storage
    sessionStorage.removeItem('scheduleFormState');

    // 한국 시간(KST, UTC+9)으로 기본 datetime 설정
    setNewEvent({
      venue_id: '',
      event_name: '',
      description: '',
      poster_image: '', // 이미지 데이터 초기화
      password: '', // 비밀번호 초기화
    });
    setSelectedArea('');
    setEditingSchedule(null);
    setIsEditing(false);
    // 파일 입력 필드 초기화
    const fileInput = document.querySelector('input[name="poster_image"]');
    if (fileInput) {
      fileInput.value = '';
    }
    // 비밀번호 입력 필드도 초기화
    const passwordInput = document.querySelector('input[name="password"]');
    if (passwordInput) {
      passwordInput.value = '';
    }
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    let poster_image_url = isEditing ? editingSchedule.poster_image : newEvent.poster_image;

    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile); // 'file'은 백엔드에서 파일을 참조할 때 사용할 이름입니다.

        const uploadResponse = await fetch(`${API_BASE_URL}/api/schedules/upload?filename=${selectedFile.name}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        body: formData,
        credentials: 'include',
      });

        if (!uploadResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { url } = await uploadResponse.json();
        poster_image_url = url;

      } catch (error) {
        console.error('Error uploading file:', error);
        alert(`이미지 업로드에 실패했습니다: ${error.message}`);
        return;
      }
    }

    const rawData = isEditing ? { ...editingSchedule, poster_image: poster_image_url } : { ...newEvent, poster_image: poster_image_url };
    
    if (!rawData.event_date) {
      alert('날짜는 필수 항목입니다. 이미지에서 날짜를 인식하지 못한 경우, 다른 이미지를 사용해 보세요.');
      return;
    }
    
    const localDate = new Date(rawData.event_date);
    const utcDate = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000));
    const dataToSubmit = {
      ...rawData,
      event_date: utcDate.toISOString(),
      poster_image_url: poster_image_url
    };

    if (!dataToSubmit.venue_id) {
      alert('공연장은 필수 항목입니다.');
      return;
    }

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing 
        ? `${API_BASE_URL}/api/schedules/${editingSchedule.id}`
        : `${API_BASE_URL}/api/schedules`;
      const body = JSON.stringify(dataToSubmit);

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response was not ok');
      }

      sessionStorage.removeItem('schedules');
      resetForm();
      await fetchSchedules();
      alert(isEditing ? '공연일정이 수정되었습니다!' : '공연일정이 저장되었습니다!');
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} schedule:`, error);
      alert(`${isEditing ? '수정' : '저장'}에 실패했습니다: ${error.message}`);
    }
  }, [newEvent, editingSchedule, isEditing, fetchSchedules, API_BASE_URL, selectedFile, adminToken]);

  const handleEditClick = (schedule) => {
    const venue = venues.find(v => v.id === schedule.venue_id);
    if (venue) {
      setSelectedArea(venue.area);
      setFilteredVenues(venues.filter(v => v.area === venue.area));
    }
    // UTC 시간을 로컬 시간대로 변환하여 datetime-local 형식에 맞춤
    setEditingSchedule({
      id: schedule.id,
      venue_id: schedule.venue_id,
      event_name: schedule.event_name,
      event_date: schedule.event_date,
      description: schedule.description,
      poster_image: schedule.poster_image, // 이미지 데이터 로드
      password: '',
    });
    setIsEditing(true);
  };

  // 로그인 처리 함수
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // 백엔드에 로그인 요청 (이메일과 비밀번호 검증)
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 포함하여 요청 전송
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsLoggedIn(true);
        setAdminToken(data.token); // 토큰 상태 업데이트
        setLoginError('');
        // 토큰을 로컬스토리지에 저장하여 새로고침해도 유지
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('isAdminLoggedIn', 'true');
      } else {
        setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('로그인 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAdminToken(null); // 토큰 상태 초기화
    setLoginEmail('');
    setLoginPassword('');
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('adminToken');
    resetForm();
  };

  // 승인 대기 공연장 관리자 목록 조회 함수
  const fetchPendingManagers = useCallback(async () => {
    setPendingManagersError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pending-venue-managers`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPendingManagers(data.pending_managers);
      } else if (response.status === 403) {
        console.error('Failed to fetch pending managers: 403 Forbidden. Check admin permissions.');
        setPendingManagersError('목록을 조회할 권한이 없습니다. 관리자에게 문의하세요.');
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch pending managers:', response.status, errorText);
        setPendingManagersError('승인 대기 목록을 불러오는 데 실패했습니다.');
      }
    } catch (error) {
      console.error('Error fetching pending managers:', error);
      setPendingManagersError('승인 대기 목록을 불러오는 중 오류가 발생했습니다.');
    }
  }, [API_BASE_URL, adminToken]);

  // 공연장 관리자 승인/거절 처리 함수
  const handleApproveManager = async (userId, approve) => {
    const message = approve ? '이 관리자를 승인하시겠습니까?' : '이 관리자 가입을 거절하시겠습니까?';
    if (!window.confirm(message)) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/approve-venue-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, approve: approve })
      });
      
      if (response.ok) {
        alert(approve ? '관리자가 승인되었습니다.' : '관리자 가입이 거절되었습니다.');
        fetchPendingManagers(); // 목록 새로고침
      } else {
        const errorData = await response.json();
        alert(`처리에 실패했습니다: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error approving manager:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    const loggedIn = localStorage.getItem('isAdminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
  }, []);

  // 로그인 상태일 때 승인 대기 관리자 목록 조회
  useEffect(() => {
    if (isLoggedIn) {
      fetchPendingManagers();
    }
  }, [isLoggedIn, fetchPendingManagers]);

    const handleDelete = useCallback(async (id) => {
    if (!window.confirm('정말로 이 일정을 삭제하시겠습니까?')) {
      return;
    }
    try {
      console.log('Sending DELETE to:', `${API_BASE_URL}/api/schedules?id=${id}`);
      const response = await fetch(`${API_BASE_URL}/api/schedules?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Network response was not ok');
      }

      console.log('Server success: Schedule deleted');
      sessionStorage.removeItem('schedules');
      await fetchSchedules();
      alert('공연일정이 삭제되었습니다!');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert(`삭제에 실패했습니다: ${error.message}`);
    }
  }, [fetchSchedules, API_BASE_URL, adminToken]);

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleScheduleClick = (venueId) => {
    const venue = venues.find(v => v.id === venueId);
    if (venue && venue.websiteUrl) {
      window.open(venue.websiteUrl, '_blank');
    } else {
      alert('등록된 홈페이지 정보가 없습니다.');
    }
  };


  const areas = [...new Set(venues.map(venue => venue.area).filter(Boolean))];
  const areaNames = {
    hongdae: '홍대',
    itaewon: '이태원',
  };

  return (
    <div className="schedule-page">
      {/* 관리자 로그인이 필요한 경우 로그인 폼 표시 */}
      {!isLoggedIn && (
        <div className="login-form-container">
          <h2>관리자 로그인</h2>
          <form onSubmit={handleLogin} className="login-form">
            {loginError && <p className="login-error">{loginError}</p>}
            <input
              type="email"
              placeholder="이메일"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
            <button type="submit" className="login-button">로그인</button>
          </form>
          <p className="register-link">
            공연장 관리자이신가요? <a href="#/venue-register">회원가입 신청하기</a>
          </p>
        </div>
      )}

      {/* 로그인된 사용자에게만 일정 관리 폼 표시 */}
      {isLoggedIn && (
        <div className="schedule-form-container">
          {/* OCR 처리 중 오버레이 표시 */}
          {isProcessingOCR && (
            <div className="ocr-loading-overlay">
              <div className="ocr-loading-message">
                이미지에서 텍스트를 추출중입니다... 잠시만 기다려주세요.
              </div>
            </div>
          )}
          <div className="admin-header">
            <h2>{isEditing ? '공연일정 수정' : '새 공연일정 등록'}</h2>
            <div className="admin-controls">
              <button 
                onClick={() => setShowPendingList(!showPendingList)} 
                className="pending-button"
                disabled={isProcessingOCR}
              >
                승인대기 관리자 {pendingManagers.length > 0 && `(${pendingManagers.length})`}
              </button>
              <button onClick={handleLogout} className="logout-button" disabled={isProcessingOCR}>로그아웃</button>
            </div>
          </div>
          
          {/* 승인 대기 공연장 관리자 목록 */}
          {pendingManagersError && <p className="error-message">{pendingManagersError}</p>}
          {showPendingList && pendingManagers.length > 0 && (
            <div className="pending-managers-container">
              <h3>승인 대기 중인 공연장 관리자 ({pendingManagers.length}명)</h3>
              <div className="pending-managers-list">
                {pendingManagers.map(manager => (
                  <div key={manager.id} className="manager-card">
                    <div className="manager-info">
                      <p><strong>이메일:</strong> {manager.email}</p>
                      <p><strong>전화번호:</strong> {manager.phone_number}</p>
                      <p><strong>공연장ID:</strong> {manager.venue_id}</p>
                      <p><strong>사업자번호:</strong> {manager.business_registration_number}</p>
                      <p><strong>이메일인증:</strong> ✅ 완료</p>
                      <p><strong>가입일:</strong> {new Date(manager.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    <div className="manager-actions">
                      <button 
                        onClick={() => handleApproveManager(manager.id, true)}
                        className="approve-button"
                      >
                        승인
                      </button>
                      <button 
                        onClick={() => handleApproveManager(manager.id, false)}
                        className="reject-button"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 승인 대기 관리자가 없을 때 */}
          {showPendingList && pendingManagers.length === 0 && (
            <div className="pending-managers-container">
              <p>승인 대기 중인 공연장 관리자가 없습니다.</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="schedule-form">
          <select
            name="area"
            value={selectedArea}
            onChange={handleAreaChange}
            required
          >
            <option value="">지역을 먼저 선택하세요</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {areaNames[area] || area}
              </option>
            ))}
          </select>
          <select
            name="venue_id"
            value={isEditing ? editingSchedule?.venue_id || '' : newEvent.venue_id}
            onChange={(e) => {
              const { name, value } = e.target;
              if (isEditing) {
                setEditingSchedule(prev => ({ ...prev, [name]: value }));
              } else {
                setNewEvent(prev => ({ ...prev, [name]: value }));
              }
            }}
            required
            disabled={!selectedArea}
          >
            <option value="">공연장을 선택하세요</option>
            {filteredVenues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name[language] || venue.name['en']}
              </option>
            ))}
          </select>



          <input
            type="file"
            name="poster_image"
            accept="image/*"
            onChange={handleImageChange}
            className="poster-image-input"
          />
          { (isEditing && editingSchedule?.poster_image) || (!isEditing && newEvent.poster_image) ? (
            <div className="poster-image-preview">
              <img src={isEditing ? editingSchedule.poster_image : newEvent.poster_image} alt="Poster Preview" />
              <button type="button" onClick={() => {
                if (isEditing) {
                  setEditingSchedule(prev => ({ ...prev, poster_image: '' }));
                } else {
                  setNewEvent(prev => ({ ...prev, poster_image: '' }));
                }
                // 파일 입력 필드 초기화
                const fileInput = document.querySelector('input[name="poster_image"]');
                if (fileInput) {
                  fileInput.value = '';
                }
              }}>이미지 제거</button>
            </div>
          ) : null }
          <div className="form-buttons">
            <button type="submit" className="save-button">
              {isEditing ? '수정' : '저장'}
            </button>
            {isEditing && (
              <button type="button" onClick={handleCancelEdit} className="cancel-button">
                취소
              </button>
            )}
          </div>
        </form>
      </div>
      )}

      <div className="schedule-list-container">
        <h2>등록된 공연일정</h2>
        <ul className="schedule-list">
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <li key={schedule.id} className="schedule-item">
                <div className="schedule-item-content" onClick={() => handleScheduleClick(schedule.venue_id)}>
                  <div className="schedule-item-header">
                    <strong>{schedule.venue_name}</strong> - <span className="schedule-event-name">{schedule.event_name}</span>
                  </div>
                  <div className="schedule-item-body">
                    <span>
                      {language === 'ko' 
                        ? new Date(schedule.event_date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                        : new Date(schedule.event_date).toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
                      }
                    </span>
                    {schedule.description && <p>{schedule.description}</p>}
                    {schedule.poster_image && (
                      <div className="schedule-item-poster">
                        <img src={schedule.poster_image} alt="Poster" />
                      </div>
                    )}
                  </div>
                </div>
                {isLoggedIn && (
                  <div className="schedule-item-actions">
                    <button onClick={() => handleEditClick(schedule)} className="edit-button">수정</button>
                    <button onClick={() => handleDelete(schedule.id)} className="delete-button">삭제</button>
                  </div>
                )}
              </li>
            ))
          ) : (
            <p>등록된 공연일정이 없습니다.</p>
          )}
        </ul>
      </div>
    </div>
  );
};

export default SchedulePage;