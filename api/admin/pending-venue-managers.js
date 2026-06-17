const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // 관리자 권한 확인
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  if (!cookies?.adminLoggedIn) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }

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
        created_at
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