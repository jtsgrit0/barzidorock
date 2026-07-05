const { sql } = require('@vercel/postgres');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // --- JWT 토큰 기반 관리자 권한 확인 (수정된 부분) ---
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }
    const token = authHeader.split(' ')[1];

    // 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 최고 관리자(super-admin) 권한 확인
    if (decoded.role !== 'super-admin') {
      return res.status(403).json({ error: '접근 권한이 없습니다. 최고 관리자만 이 기능을 사용할 수 있습니다.' });
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
  // --- 여기까지 수정 ---

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 승인 대기 중인 공연장 관리자 목록 조회
    const result = await sql`
      SELECT 
        id,
        email,
        phone_number,
        venue_id,
        business_registration_number,
        business_registration_file,
        phone_verified,
        created_at,
        false AS is_admin // is_admin 컬럼이 없으므로 false로 더미 값 추가
      FROM venue_managers 
      WHERE is_approved = false
      ORDER BY created_at ASC
    `;

    return res.status(200).json({
      success: true,
      pending_managers: result.rows
    });
  } catch (error) {
    console.error('Get pending venue managers error:', error);
    return res.status(500).json({ error: '목록 조회 중 오류가 발생했습니다.' });
  }
};