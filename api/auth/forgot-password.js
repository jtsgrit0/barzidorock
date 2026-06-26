const { sql } = require('@vercel/postgres');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); // Nodemailer import

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

    // 4. 이메일 전송
    const resetLink = `https://barzidorock.vercel.app/reset-password?token=${resetToken}`;

    // Nodemailer transporter 설정
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 이메일 내용
    const mailOptions = {
      from: process.env.EMAIL_USER, // 발신자 이메일 주소
      to: email, // 수신자 이메일 주소
      subject: '비밀번호 재설정 요청',
      html: `
        <p>안녕하세요,</p>
        <p>비밀번호 재설정 요청을 받았습니다. 아래 링크를 클릭하여 비밀번호를 재설정해주세요:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>이 링크는 1시간 후에 만료됩니다.</p>
        <p>만약 이 요청을 하지 않았다면, 이 이메일을 무시하셔도 됩니다.</p>
      `,
    };

    // 이메일 전송
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: '비밀번호 재설정 지침이 이메일로 전송되었습니다.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: '비밀번호 재설정 중 오류가 발생했습니다.' });
  }
};