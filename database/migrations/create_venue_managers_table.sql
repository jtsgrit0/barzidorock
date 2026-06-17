-- 공연장 관리자 테이블 생성
CREATE TABLE IF NOT EXISTS venue_managers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  phone_verified BOOLEAN DEFAULT FALSE,
  venue_id VARCHAR(50) REFERENCES venues(id) NOT NULL,
  business_registration_number VARCHAR(20) NOT NULL,
  business_registration_file TEXT, -- 사업자등록증 파일 Base64 또는 URL
  is_approved BOOLEAN DEFAULT FALSE, -- 본인(바 CTO)이 승인해야 활성화
  verification_code VARCHAR(6), -- 전화번호 인증 코드
  verification_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_venue_managers_email ON venue_managers(email);
CREATE INDEX IF NOT EXISTS idx_venue_managers_venue_id ON venue_managers(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_managers_is_approved ON venue_managers(is_approved);

-- 기존 schedules 테이블에 manager_id 외래키 추가 (선택사항)
-- ALTER TABLE schedules ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES venue_managers(id);