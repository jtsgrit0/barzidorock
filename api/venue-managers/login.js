const { sql } = require('@vercel/postgres');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app'];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    // 이메일로 사용자 조회
    const userResult = await sql`
      SELECT id, email, password_hash, is_approved, email_verified, venue_id 
      FROM venue_managers 
      WHERE email = ${email}
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

    // JWT 토큰 생성
    const tokenPayload = {
      id: user.id,
      email: user.email,
      venue_id: user.venue_id,
      // 관리자 이메일과 일치하면 'super-admin' 역할 부여
      role: user.email === process.env.ADMIN_EMAIL ? 'super-admin' : 'venue-manager'
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' }); // 토큰 유효기간 1시간

    return res.status(200).json({
      success: true,
      message: '로그인 성공',
      token: token, // JWT 토큰 반환
      user: {
        id: user.id,
        email: user.email,
        venue_id: user.venue_id,
        role: tokenPayload.role // 클라이언트에서도 역할 정보 활용 가능
      }
    });
  } catch (error) {
    console.error('Venue manager login error:', error);
    return res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
};