const { sql } = require('@vercel/postgres');
const bcrypt = require('bcrypt');

module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호가 필요합니다.' });
    }

    // 사용자 정보 조회
    const userResult = await sql`
      SELECT * FROM venue_managers WHERE email = ${email}
    `;

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = userResult.rows[0];

    // 비밀번호 bcrypt로 비교
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 승인 여부 확인
    if (!user.is_approved) {
      return res.status(403).json({ error: '아직 관리자 승인이 완료되지 않았습니다.' });
    }

    // 이메일 인증 여부 확인
    if (!user.email_verified) {
      return res.status(403).json({ error: '이메일 인증이 완료되지 않았습니다.' });
    }

    // 로그인 세션 쿠키 설정
    res.setHeader('Set-Cookie', `venueManagerLoggedIn=${user.id}; HttpOnly; Secure; SameSite=None; Domain=barzidorock-2akv.vercel.app; Path=/; Max-Age=86400`);
    
    return res.status(200).json({ 
      success: true, 
      message: '로그인 성공',
      user: {
        id: user.id,
        email: user.email,
        venue_id: user.venue_id
      }
    });
  } catch (error) {
    console.error('Venue manager login error:', error);
    return res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
};