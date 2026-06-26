const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app', 'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // OPTIONS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '이메일을 입력해주세요.' });
  }

  try {
    // 1. 이메일로 사용자 찾기
    const userResult = await sql`
      SELECT id FROM venue_managers WHERE email = ${email}
    `;

    if (userResult.rows.length === 0) {
      // 보안을 위해 사용자가 존재하지 않아도 성공 메시지를 반환합니다.
      return res.status(200).json({ message: '비밀번호 재설정 지침이 이메일로 전송되었습니다.' });
    }

    const userId = userResult.rows[0].id;

    // 2. 재설정 토큰 생성
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1시간 후 만료

    // 3. 데이터베이스에 토큰 저장
    await sql`
      UPDATE venue_managers
      SET reset_password_token = ${resetToken},
          reset_password_expires = ${resetTokenExpires.toISOString()}
      WHERE id = ${userId}
    `;

    // 4. 이메일 전송 (자리 표시자)
    // 실제 이메일 전송 로직은 여기에 구현되어야 합니다 (예: Nodemailer 사용).
    // 현재는 콘솔에 링크를 로깅합니다.
    const resetLink = `https://barzidorock.vercel.app/reset-password?token=${resetToken}`;
    console.log(`비밀번호 재설정 링크: ${resetLink} (이메일: ${email})`);

    return res.status(200).json({ message: '비밀번호 재설정 지침이 이메일로 전송되었습니다.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: '비밀번호 재설정 중 오류가 발생했습니다.' });
  }
};