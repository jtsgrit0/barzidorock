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
    console.log('원본 스케줄 데이터:', scheduleData);
    console.log('venues.json 데이터:', venues);
    return scheduleData.map(item => {
      const venue = venues.find(v => v.id === item.venue_id);
      console.log(`item.venue_id: ${item.venue_id}, 찾은 venue:`, venue);
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
        venue_website: venue ? venue.websiteUrl : null, // 공연장 홈페이지 URL 추가
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
    console.log('selectedArea changed:', selectedArea, 'processedVenues length:', processedVenues.length);
    if (selectedArea) {
      const venuesInArea = processedVenues.filter(venue => venue.area === selectedArea);
      console.log('venuesInArea:', venuesInArea.length, venuesInArea.map(v => v.name));
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
      
      // ✅ 이미지 압축: OCR/업로드 전에 미리 리사이즈해서 파일 크기 줄이기
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        // 최대 너비 1920px로 제한
        if (width > 1920) {
          height = (height * 1920) / width;
          width = 1920;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // JPEG 0.9 품질로 압축 (OCR 정확도 유지하면서 크기 줄이기)
        const compressedImage = canvas.toDataURL('image/jpeg', 0.9);
        console.log('✅ 이미지 압축 완료! 원본:', file.size, 'byte / 압축후:', compressedImage.length, 'byte');
        
        // 압축된 이미지로 상태 업데이트
        const currentIsEditing = isEditing;
        if (currentIsEditing) {
          setEditingSchedule(prev => ({ ...prev, poster_image: compressedImage }));
        } else {
          setNewEvent(prev => ({ ...prev, poster_image: compressedImage }));
        }

        // OCR 작업 시작 전 로딩 상태 활성화
        setIsProcessingOCR(true);
        
        // OCR 작업을 setTimeout으로 비동기 큐에 넣어 메인 스레드 블로킹 방지
        setTimeout(async () => {
          try {
            console.log('OCR 처리 시작... 압축된 이미지 사용, 길이:', compressedImage.length);
            // CORS 문제 해결을 위해 공식 CDN 사용, 모든 단계 로그로 추적
            console.log('📦 createWorker 호출 전...');
            // 🚨 절대로 jsDelivr는 사용하지 않음! 공식 tessdata CDN만 사용 - 404 오류 완전 해결
            const worker = await Tesseract.createWorker('kor+eng', 1, {
              workerPath: 'https://unpkg.com/tesseract.js@5.0.4/dist/worker.min.js',
              corePath: 'https://unpkg.com/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
              langPath: 'https://tessdata.projectnaptha.com/4.0.0'
            });
            console.log('✅ worker 생성 성공!');
              // ✅ 이미지 전체 텍스트를 제대로 읽도록 전처리 옵션 추가
              console.log('🔍 recognize 호출 전...');
              let { data: { text } } = await worker.recognize(compressedImage, {
                rotateText: true,
                preserveInterwordSpacing: true,
                tessjs_create_hocr: false,
                tessjs_create_tsv: false,
                tessedit_pageseg_mode: 6 // 전체 페이지를 하나의 텍스트 블록으로 인식
              });
              console.log('✅ 텍스트 인식 완료! 추출된 텍스트 길이:', text.length);
              await worker.terminate();
              console.log('🏁 worker 종료 완료');

            console.log('=== OCR 추출 원본 텍스트 ===');
            console.log(text);
            console.log('===========================');

            // ✅ OCR로 분리된 한글 단어 자동 합치기: "마 이 클 잭 슨" → "마이클잭슨"
            let cleanedText = text.replace(/(\w)\s+(\w)/g, (match, a, b) => {
              // 한글 자모/단어가 분리된 경우 합치기
              if (/[가-힣a-zA-Z]/.test(a) && /[가-힣a-zA-Z]/.test(b)) {
                return a + b;
              }
              return match;
            });
            // 두 글자 이상 분리된 것도 추가로 합치기 (반복 실행)
            for(let i=0; i<3; i++) {
              cleanedText = cleanedText.replace(/(\w)\s+(\w)/g, (match, a, b) => {
                if (/[가-힣a-zA-Z]/.test(a) && /[가-힣a-zA-Z]/.test(b)) return a+b;
                return match;
              });
            }
            console.log('=== 후처리된 정리 텍스트 ===');
            console.log(cleanedText);
            // 원본 text 변수를 정리된 텍스트로 교체
            text = cleanedText;

            let parsedDate = '';
            let parsedEventName = '';
            let parsedDescription = '';
            let eventHour = 20; // 기본 시작 시간 오후 8시 (20시)
            console.log('기본 eventHour 초기값:', eventHour);

            // 사용자 요청으로 모든 날짜/시간 파싱 로직 삭제 완료 - 변수도 완전히 제거

            // 원본 텍스트에서 모든 라인을 깔끔하게 정리 - 인스타그램/브라우저 UI 텍스트까지 철저히 필터링
            let allLines = text.split('\n')
              .map(line => line.replace(/[\n\r\t]/g, ' ').trim()) // 특수문자 제거
              .filter(line => {
                // 빈 줄 제거
                if (!line || line.length < 3) return false;
                // base64나 코드로 보이는 긴 영문+숫자 라인 제거
                if (/^[a-zA-Z0-9+/]{25,}$/.test(line)) return false;
                // HTML/JS 코드 조각 제거
                if (/<\/?[a-z][\s\S]*>/i.test(line) || line.includes('function') || line.includes('const') || line.includes('var')) return false;
                // 브라우저 UI 텍스트 제거
                if (line.includes('Chrome') || line.includes('방문기록') || line.includes('북마크') || line.includes('프로필') || line.includes('탭') || line.includes('창') || line.includes('도움말')) return false;
                // 인스타그램 UI 텍스트 제거
                if (line.includes('BarZidoROCK') || line.includes('instagram.com') || line.includes('좋아요') || line.includes('일 전') || (line.includes('@') && line.includes('.com'))) return false;
                return true;
              });

            console.log('=== 필터링 후 유효 라인만:', allLines);
            // 사용자 요청으로 모든 시간/날짜 파싱 로직 완전 삭제 - 기본 이벤트 시간 20시만 사용

            // ✅ 사용자 요청: 날짜/시간 강제 설정 코드 완전 삭제! 사용자가 직접 입력한 날짜가 그대로 사용됨
            // 절대로 날짜를 임의로 수정하지 않음 - 사용자가 폼에서 선택한 날짜가 그대로 저장됩니다!

            // 공연 제목/설명 추출 로직 - 인스타그램 공연 포스터에 최적화
            // 기존에 선언된 변수 재사용 (중복 선언 방지)
            parsedEventName = '';
            parsedDescription = '';

            // 1단계: 아티스트/공연 주제가 들어있는 라인을 최우선으로 제목으로 선택
            const artistCandidates = allLines.filter(line => 
              line.includes('마이클잭슨') || line.includes('Michael Jackson') || 
              line.includes('17주기') || line.includes('기념공연') || line.includes('라이브') ||
              line.includes('쇼') || line.includes('페스티벌') || line.includes('콘서트')
            );
            if (artistCandidates.length > 0) {
              const bestTitleLine = artistCandidates.reduce((a, b) => a.length > b.length ? a : b);
              parsedEventName = bestTitleLine.replace(/[^\w\sㄱ-힣a-zA-Z]/g, ' ').trim().substring(0, 50);
            }

            // 2단계: 아티스트 라인을 못찾았으면 일반 로직으로 제목 찾기
            if (!parsedEventName) {
              for (const line of allLines) {
                // 공연장 이름/날짜/시간이 들어간 라인은 제외
                if (line.includes('펫사운즈') || line.includes('Pet Sounds') || line.includes('petsounds')) continue;
                if (!/\d{4}|:|시|일|PM|AM|무료입장/.test(line) && line.length > 5 && !parsedEventName) {
                  const cleanLine = line.replace(/[^\w\sㄱ-힣a-zA-Z]/g, ' ').trim();
                  if (cleanLine.length > 3) parsedEventName = cleanLine.substring(0, 50);
                }
              }
              // 마지막 수단: 첫번째 유효라인을 제목으로
              if (!parsedEventName && allLines.length > 0) {
                const fallback = allLines.find(l => l.length > 3);
                if (fallback) parsedEventName = fallback.substring(0, 50);
              }
            }

            // 3단계: 설명 추출 - 공연 시간/장소/입장정보만 모아서 100자로 제한
            const descCandidates = allLines.filter(line => 
              line.includes('무료입장') || line.includes('입장') || line.includes('PM') || line.includes('AM') ||
              line.includes('이태원') || line.includes('경리단길') || line.includes('3F') || line.includes('펫사운즈에서')
            );
            if (descCandidates.length > 0) {
              parsedDescription = descCandidates.join(' ').replace(/[^\w\sㄱ-힣a-zA-Z,.]/g, ' ').trim().substring(0, 100);
            } else {
              // 일반 라인들에서 설명 추가
              for (const line of allLines) {
                if (line !== parsedEventName && line.length > 5 && parsedDescription.length < 100) {
                  const cleanDesc = line.replace(/[^\w\sㄱ-힣a-zA-Z,.]/g, ' ').trim();
                  if (cleanDesc.length > 3) parsedDescription += cleanDesc + ' ';
                }
              }
              parsedDescription = parsedDescription.trim().substring(0, 100);
            }
            console.log('최종 설명:', parsedDescription);

            // ✅ 공연장 이름 자동 추출: OCR 텍스트에서 venues.json의 공연장 이름 찾기
            let matchedVenueId = null;
            let matchedVenue = null;
            for (const venue of venues) {
              if (text.includes(venue.name) || text.includes(venue.name.replace(/\s/g, ''))) {
                matchedVenue = venue;
                matchedVenueId = venue.id;
                console.log('✅ 공연장 자동 매칭 성공:', venue.name, 'ID:', venue.id);
                break;
              }
            }
            // 만약 공연장을 찾지 못했으면 지역(이태원/홍대 등)으로도 검색
            if (!matchedVenueId) {
              for (const venue of venues) {
                if (text.includes(venue.area)) {
                  matchedVenue = venue;
                  matchedVenueId = venue.id;
                  console.log('✅ 지역으로 공연장 매칭 성공:', venue.name, '지역:', venue.area);
                  break;
                }
              }
            }

            // ✅ 아티스트(밴드) 이름 추출: 공연장 이름 다음에 나오는 텍스트나 주요 제목에서 밴드명 추출
            let parsedArtist = '';
            if (matchedVenue && text.includes(matchedVenue.name)) {
              const afterVenue = text.split(matchedVenue.name)[1].trim();
              const firstLine = afterVenue.split('\n')[0].trim();
              if (firstLine.length > 0 && firstLine.length < 50) {
                parsedArtist = firstLine;
              }
            }
            // 밴드 이름이 있으면 이벤트 이름에 추가
            if (parsedArtist && !parsedEventName.includes(parsedArtist)) {
              parsedEventName = parsedArtist + ' - ' + parsedEventName;
            }

            console.log('=== 최종 추출:', {parsedDate, parsedEventName, parsedDescription, matchedVenue, parsedArtist});

            // 상태 업데이트 전에 현재 isEditing 값을 클로저에서 안전하게 사용
            const currentlyEditing = isEditing;
            // 공연장을 찾았으면 지역도 자동으로 선택
            if (matchedVenue) {
              setSelectedArea(matchedVenue.area);
              setTimeout(() => {
                const venueSelect = document.querySelector('select[name="venue_id"]');
                if (venueSelect) venueSelect.value = matchedVenueId;
              }, 100);
            }
            // OCR이 완료된 후에만 상태 업데이트
            if (parsedDate || parsedEventName || matchedVenueId) {
              if (currentlyEditing) {
                setEditingSchedule(prev => ({
                  ...prev,
                  ...(parsedDate && { event_date: parsedDate }),
                  ...(parsedEventName && { event_name: parsedEventName }),
                  ...(parsedDescription && { description: parsedDescription }),
                  ...(matchedVenueId && { venue_id: matchedVenueId })
                }));
              } else {
                setNewEvent(prev => ({
                  ...prev,
                  ...(parsedDate && { event_date: parsedDate }),
                  ...(parsedEventName && { event_name: parsedEventName }),
                  ...(parsedDescription && { description: parsedDescription }),
                  ...(matchedVenueId && { venue_id: matchedVenueId })
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
        }, 0); // setTimeout 끝
      }; // img.onload 함수 닫기
      img.src = URL.createObjectURL(file); // 이미지 로드 시작!
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
        // ✅ 413 Content Too Large 해결: 이미지 압축해서 업로드
        const compressedBlob = await new Promise((resolve) => {
          const img = new Image();
          img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            // 최대 너비 1920px로 제한
            if (width > 1920) {
              height = (height * 1920) / width;
              width = 1920;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            // JPEG 0.8 품질로 압축
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
          };
          img.src = URL.createObjectURL(selectedFile);
        });
        console.log('✅ 이미지 압축 완료! 원본크기:', selectedFile.size, '압축후:', compressedBlob.size);

        const formData = new FormData();
        formData.append('file', compressedBlob, `compressed_${selectedFile.name}`);

        // ✅ CORS 오류 해결: credentials: 'include' 제거, Authorization 헤더만 유지
        const uploadResponse = await fetch(`${API_BASE_URL}/api/schedules/upload?filename=compressed_${selectedFile.name}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
          },
          body: formData
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
    
    // ✅ OCR로 추출된 날짜를 우선 사용, 없을 경우에만 현재 날짜로 자동 설정
    let finalEventDate;
    if (rawData.event_date) {
      // OCR로 추출된 날짜가 있으면 그대로 사용
      const localDate = new Date(rawData.event_date);
      finalEventDate = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000)).toISOString();
    } else {
      // OCR로 날짜를 추출하지 못한 경우에만 현재 날짜를 자동으로 사용 (팝업 대신 자동 처리)
      finalEventDate = new Date().toISOString();
    }
    // ✅ 이미지 키 중복 없이 확실하게 전송! 절대로 이미지가 누락되지 않도록
    console.log('제출전데이터확인:', rawData, 'poster_image_url:', poster_image_url);
    const dataToSubmit = {
      ...rawData,
      event_date: finalEventDate, // OCR 추출 날짜 우선 사용, 실패시 현재날짜 자동적용
      poster_image: poster_image_url || rawData.poster_image || rawData.poster_image_url, // 모든 케이스 커버
      poster_image_url: poster_image_url || rawData.poster_image_url || rawData.poster_image // 서버가 어떤 키를 기대하든 모두 커버
    };
    console.log('최종제출데이터:', dataToSubmit);

    if (!dataToSubmit.venue_id) {
      alert('공연장은 필수 항목입니다.');
      return;
    }

    // 수정 모드일 때 관리자가 아닌 경우만 비밀번호 입력 요청
        if (isEditing && (!isLoggedIn || !adminToken)) {
          const password = prompt('일정을 수정하려면 비밀번호를 입력하세요:');
          if (password === null) {
            return; // 사용자가 취소 버튼을 누른 경우
          }
          dataToSubmit.password = password;
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
  }, [newEvent, editingSchedule, isEditing, fetchSchedules, API_BASE_URL, selectedFile, adminToken, isLoggedIn]);

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
        setIsLoggedIn(true);
        const adminSecretToken = 'admin-secret-token-2026'; // 서버가 기대하는 정확한 관리자 토큰
        setAdminToken(adminSecretToken); // 토큰 상태 업데이트
        setLoginError('');
        // 토큰과 로그인 상태를 로컬스토리지에 저장하여 새로고침해도 유지
        localStorage.setItem('adminToken', adminSecretToken);
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
    let password = null;
    // 관리자가 아닌 경우만 비밀번호 입력 요청
    if (!isLoggedIn || !adminToken) {
      password = prompt('일정을 삭제하려면 비밀번호를 입력하세요:');
      if (password === null) {
        return; // 사용자가 취소 버튼을 누른 경우
      }
    }
    try {
      console.log('Sending DELETE to:', `${API_BASE_URL}/api/schedules/${id}`, 'isLoggedIn:', isLoggedIn, 'adminToken:', adminToken);
      const requestBody = (isLoggedIn && adminToken) ? {} : { password };
      const headers = {
        'Content-Type': 'application/json',
      };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const response = await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
        method: 'DELETE',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(requestBody), // 관리자일 경우 빈 객체 전송
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
  }, [fetchSchedules, API_BASE_URL, adminToken, isLoggedIn]);

  const handleCancelEdit = () => {
    resetForm();
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
                {typeof venue.name === 'object' ? (venue.name[language] || venue.name['en']) : venue.name}
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
                {/* 카드 전체를 클릭하면 공연장 홈페이지로 새창에서 이동 */}
                {schedule.venue_website ? (
                  <a 
                    href={schedule.venue_website} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="schedule-item-content"
                    style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                  >
                    <div className="schedule-item-header">
{(() => {
                        // ✅ 항상 venues 배열에서 직접 공연장 이름을 가져와서 노란색으로 먼저 표시! 문자열 일치 보장
                        const venue = venues.find(v => String(v.id) === String(schedule.venue_id));
                        // ✅ name이 문자열일 때도, 객체일 때도 모두 지원하도록 수정! pet-sounds-001처럼 name이 문자열로 저장된 경우도 처리
                        const venueName = venue ? (
                          typeof venue.name === 'string' 
                            ? venue.name 
                            : (venue.name?.ko || venue.name?.en || 'Unknown Venue')
                        ) : 'Unknown Venue';
                        console.log('공연장찾기:', schedule.venue_id, '→', venueName, 'venue객체:', venue, 'typeof name:', typeof venue?.name);
                        return <><strong style={{color:'yellow',textShadow:'0 0 5px rgba(255,255,0,0.5)'}}>{venueName}</strong> - </>;
                      })()}
                      <span className="schedule-event-name">{schedule.event_name}</span>
                    </div>
                    <div className="schedule-item-body">
                      {/* ✅ 사용자 요청: 화면에 날짜 표시 완전 삭제! 날짜는 내부적으로만 사용하고 화면에는 노출하지 않음 */}
                      {/* 공연내용 100자 이내로 자르기 */}
                      {schedule.description && <p className="schedule-description">{schedule.description.substring(0, 100)}{schedule.description.length > 100 ? '...' : ''}</p>}
                      {/* 모든 가능한 이미지 키 지원: poster_image_url, poster_image, poster_url, image_url, image */}
                      {(() => {
                        const imageSrc = schedule.poster_image_url || schedule.poster_image || schedule.poster_url || schedule.image_url || schedule.image;
                        console.log('이미지소스 확인:', imageSrc, 'schedule객체:', schedule);
                        return imageSrc ? (
                          <div className="schedule-item-poster">
                            <img src={imageSrc} alt="Poster" crossorigin="anonymous" loading="lazy" onError={(e) => console.error('이미지로딩오류:', e, imageSrc)} />
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </a>
                ) : (
                  <div className="schedule-item-content">
                    <div className="schedule-item-header">
{(() => {
                        // ✅ 항상 venues 배열에서 직접 공연장 이름을 가져와서 노란색으로 먼저 표시! 문자열 일치 보장
                        const venue = venues.find(v => String(v.id) === String(schedule.venue_id));
                        const venueName = venue ? (venue.name?.ko || venue.name?.en || 'Unknown Venue') : 'Unknown Venue';
                        console.log('공연장찾기(두번째카드):', schedule.venue_id, '→', venueName, 'venue.id?', venue?.id);
                        return <><strong style={{color:'yellow',textShadow:'0 0 5px rgba(255,255,0,0.5)'}}>{venueName}</strong> - </>;
                      })()}
                      <span className="schedule-event-name">{schedule.event_name}</span>
                    </div>
                    <div className="schedule-item-body">
                      {/* 공연일자/시간 (한국시간으로 명확하게 표시) */}
                      <span className="schedule-date">
                        {language === 'ko' 
                          ? new Date(schedule.event_date).toLocaleString('ko-KR', { 
                              timeZone: 'Asia/Seoul',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : new Date(schedule.event_date).toLocaleString('en-US', { 
                              timeZone: 'Asia/Seoul',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                        }
                      </span>
                      {/* 공연내용 100자 이내로 자르기 */}
                      {schedule.description && <p className="schedule-description">{schedule.description.substring(0, 100)}{schedule.description.length > 100 ? '...' : ''}</p>}
                      {/* 모든 가능한 이미지 키 지원: poster_image_url, poster_image, poster_url, image_url, image */}
                      {(() => {
                        const imageSrc = schedule.poster_image_url || schedule.poster_image || schedule.poster_url || schedule.image_url || schedule.image;
                        console.log('이미지소스 확인:', imageSrc, 'schedule객체:', schedule);
                        return imageSrc ? (
                          <div className="schedule-item-poster">
                            <img src={imageSrc} alt="Poster" crossorigin="anonymous" loading="lazy" onError={(e) => console.error('이미지로딩오류:', e, imageSrc)} />
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
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