const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// 이메일 인증 코드 생성 (6자리 숫자)
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '이메일이 필요합니다' });
  }

  try {
    // 이메일 형식 검증
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '유효한 이메일 형식이 아닙니다' });
    }

    // 이미 가입된 이메일인지 확인
    const existingUser = await pool.query(
      'SELECT * FROM venue_managers WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '이미 등록된 이메일입니다' });
    }

    // 인증 코드 생성 및 저장
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10분 후 만료

    // 기존 인증 코드 삭제
    await pool.query(
      'DELETE FROM email_verifications WHERE email = $1',
      [email]
    );

    // 새 인증 코드 저장
    await pool.query(
      'INSERT INTO email_verifications (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, verificationCode, expiresAt]
    );

    // 이메일 발송 설정
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // 이메일 내용
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: '바지도락 공연장 관리자 이메일 인증 코드',
      html: `
        <h1>바지도락 공연장 관리자 이메일 인증</h1>
        <p>안녕하세요, 바지도락입니다.</p>
        <p>아래의 인증 코드를 입력하여 이메일 인증을 완료해주세요.</p>
        <h2 style="font-size: 32px; letter-spacing: 5px;">${verificationCode}</h2>
        <p>인증 코드는 10분간 유효합니다.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">본 이메일은 바지도락 공연장 관리자 회원가입 과정에서 발송되었습니다.</p>
      `
    };

    // 이메일 발송
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: '인증 코드가 이메일로 전송되었습니다' });
  } catch (error) {
    console.error('이메일 인증 코드 발송 오류:', error);
    return res.status(500).json({ error: '인증 코드 전송에 실패했습니다' });
  }
};