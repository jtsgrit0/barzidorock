const { sql } = require('@vercel/postgres');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = [
    'https://jtsgrit0.github.io',
    'http://localhost:3000',
    'https://barzidorock.vercel.app',
    'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    // 데이터베이스에서 사용자 정보 조회
    const { rows } = await sql`
      SELECT id, email, password, role 
      FROM admin_users 
      WHERE email = ${email}
    `;

    if (rows.length === 0) {
      return res.status(401).json({ error: '존재하지 않는 사용자입니다.' });
    }

    const user = rows[0];

    // 비밀번호 비교
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    // JWT 토큰 생성 (role 정보 포함)
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role // DB에서 조회한 role을 토큰에 포함
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // 토큰 유효기간 1일
    );

    // 로그인 성공
    return res.status(200).json({ 
      success: true, 
      message: '로그인 성공', 
      token: token 
    });

  } catch (error) {
    console.error('Login API error:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
};