const { sql } = require('@vercel/postgres');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

// 이메일 발송 설정
const createTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Gmail credentials not configured; email notifications disabled');
    return null;
  }

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
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app']; const origin = req.headers.origin; if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // --- JWT 토큰 기반 관리자 권한 확인 ---
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }
    const token = authHeader.split(' ')[1];

    // 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');

    // 최고 관리자(super-admin) 권한 확인
    if (decoded.role !== 'super-admin' && !decoded.is_admin) {
      return res.status(403).json({ error: '접근 권한이 없습니다. 최고 관리자만 이 기능을 사용할 수 있습니다.' });
    }
  } catch (error) {
    console.error('Approve venue manager auth error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
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
      if (transporter) {
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
      }
      
      return res.status(200).json({ success: true, message: '공연장 관리자가 승인되었습니다.' });
    } else {
      // 거절 처리 이메일 발송
      if (transporter) {
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