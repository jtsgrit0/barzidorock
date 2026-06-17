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

  // 관리자 권한 확인 (기존 로그인 세션 확인)
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  if (!cookies?.adminLoggedIn) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, approve } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
    }

    if (approve) {
      // 승인 처리
      await sql`
        UPDATE venue_managers 
        SET is_approved = true,
            updated_at = NOW()
        WHERE id = ${user_id}
      `;
      return res.status(200).json({ success: true, message: '공연장 관리자가 승인되었습니다.' });
    } else {
      // 거절 처리 (계정 삭제 또는 상태 변경)
      await sql`
        DELETE FROM venue_managers WHERE id = ${user_id}
      `;
      return res.status(200).json({ success: true, message: '공연장 관리자 가입이 거절되었습니다.' });
    }
  } catch (error) {
    console.error('Approve venue manager error:', error);
    return res.status(500).json({ error: '승인 처리 중 오류가 발생했습니다.' });
  }
};