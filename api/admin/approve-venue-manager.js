const { sql } = require('@vercel/postgres');
const nodemailer = require('nodemailer');

// 이메일 발송 설정
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

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

    // 승인/거절 전 사용자 이메일 조회
    const userInfo = await sql`
      SELECT email FROM venue_managers WHERE id = ${user_id}
    `;
    
    if (userInfo.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    const userEmail = userInfo.rows[0].email;
    const transporter = createTransporter();

    if (approve) {
      // 승인 처리
      await sql`
        UPDATE venue_managers 
        SET is_approved = true,
            updated_at = NOW()
        WHERE id = ${user_id}
      `;
      
      // 승인 완료 이메일 발송
      try {
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: userEmail,
          subject: '[BarZidoROCK] 공연장 관리자 승인이 완료되었습니다',
          html: `
            <h2>축하합니다! 공연장 관리자 승인이 완료되었습니다.</h2>
            <p>이제 로그인하여 공연일정을 관리하실 수 있습니다.</p>
            <p>로그인 페이지: https://jtsgrit0.github.io/barzidorock/</p>
            <br>
            <p>BarZidoROCK 관리팀 드림</p>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
      
      return res.status(200).json({ success: true, message: '공연장 관리자가 승인되었습니다.' });
    } else {
      // 거절 처리 이메일 발송
      try {
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: userEmail,
          subject: '[BarZidoROCK] 공연장 관리자 가입이 거절되었습니다',
          html: `
            <h2>공연장 관리자 가입이 거절되었습니다.</h2>
            <p>제출해주신 서류 검토 결과 가입이 거절되었습니다.</p>
            <p>자세한 문의는 관리자 이메일로 연락주시기 바랍니다.</p>
            <br>
            <p>BarZidoROCK 관리팀 드림</p>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
      
      // 거절 처리 (계정 삭제)
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