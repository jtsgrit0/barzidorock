const { sql } = require('@vercel/postgres');
const bcrypt = require('bcrypt');
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    // 슈퍼 어드민 계정 확인 (index.js의 로직과 통일)
    // 환경 변수가 없으면 하드코딩된 기본값 사용
    const adminEmail = process.env.ADMIN_EMAIL || 'jtsgrit0@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Ggdrecon3534@.!';

    if (email === adminEmail && password === adminPassword) {
      const tokenPayload = { is_admin: true, venue_id: null, role: 'super-admin' };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'secret-key', { expiresIn: '1h' });
      return res.status(200).json({
        success: true,
        message: '관리자 로그인 성공',
        token,
        user: {
          id: null,
          email: adminEmail,
          venue_id: null,
          role: 'super-admin',
          is_admin: true
        }
      });
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
      role: user.email === adminEmail ? 'super-admin' : 'venue-manager'
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'secret-key', { expiresIn: '1h' });

    return res.status(200).json({
      success: true,
      message: '로그인 성공',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        venue_id: user.venue_id,
        role: tokenPayload.role
      }
    });
  } catch (error) {
    console.error('Venue manager login error:', error);
    return res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
};