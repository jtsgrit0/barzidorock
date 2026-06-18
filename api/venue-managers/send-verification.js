const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  // CORS 설정
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
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
    const { email, phone_number } = req.body;

    if (!email || !phone_number) {
      return res.status(400).json({ error: '이메일과 전화번호가 필요합니다.' });
    }

    // 6자리 인증 코드 생성
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // 인증 코드 만료시간 (10분 후)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 사용자 정보에 인증 코드 저장
    await sql`
      UPDATE venue_managers 
      SET verification_code = ${verificationCode}, 
          verification_expires_at = ${expiresAt},
          updated_at = NOW()
      WHERE email = ${email}
    `;

    // TODO: 실제 SMS 서비스(Twilio, 알리고 등)로 인증 코드 전송
    console.log(`[DEV] 전화번호 ${phone_number}으로 인증 코드 ${verificationCode} 전송`);
    
    // 개발 환경에서는 콘솔에만 로그 남기고 실제 SMS는 보내지 않음
    // 프로덕션에서는 아래 주석을 해제하고 SMS 서비스 연동 필요
    /*
    await sendSMS(phone_number, `[BarZidoROCK] 인증코드: ${verificationCode}`);
    */

    return res.status(200).json({ 
      success: true, 
      message: '인증 코드가 전송되었습니다. 10분 내에 입력해주세요.',
      dev_code: process.env.NODE_ENV === 'development' ? verificationCode : undefined
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    return res.status(500).json({ error: '인증 코드 전송 중 오류가 발생했습니다.' });
  }
};