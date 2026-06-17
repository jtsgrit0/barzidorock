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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, verification_code } = req.body;

    if (!email || !verification_code) {
      return res.status(400).json({ error: '이메일과 인증 코드가 필요합니다.' });
    }

    // 사용자 정보 조회
    const userResult = await sql`
      SELECT * FROM venue_managers WHERE email = ${email}
    `;

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const user = userResult.rows[0];

    // 인증 코드 만료 확인
    if (new Date() > new Date(user.verification_expires_at)) {
      return res.status(400).json({ error: '인증 코드가 만료되었습니다. 다시 요청해주세요.' });
    }

    // 인증 코드 일치 확인
    if (user.verification_code !== verification_code) {
      return res.status(400).json({ error: '인증 코드가 일치하지 않습니다.' });
    }

    // 전화번호 인증 완료 처리
    await sql`
      UPDATE venue_managers 
      SET phone_verified = true,
          verification_code = NULL,
          verification_expires_at = NULL,
          updated_at = NOW()
      WHERE email = ${email}
    `;

    return res.status(200).json({ 
      success: true, 
      message: '전화번호 인증이 완료되었습니다.'
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    return res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다.' });
  }
};