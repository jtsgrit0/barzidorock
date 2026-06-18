const { sql } = require('@vercel/postgres');
const bcrypt = require('bcrypt');

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://jtsgrit0.github.io');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      email, 
      password, 
      phone_number, 
      venue_id, 
      business_registration_number,
      business_registration_file 
    } = req.body;

    // 필수 필드 검증
    if (!email || !password || !phone_number || !venue_id || !business_registration_number) {
      return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
    }

    // 이미 가입된 이메일인지 확인
    const existingUser = await sql`
      SELECT * FROM venue_managers WHERE email = ${email}
    `;

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }

    // 비밀번호 bcrypt로 해싱
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 관리자 승인 대기 상태로 회원가입 처리
    const result = await sql`
      INSERT INTO venue_managers (
        email, 
        password_hash, 
        phone_number, 
        venue_id, 
        business_registration_number,
        business_registration_file,
        is_approved,
        created_at
      ) VALUES (
        ${email},
        ${passwordHash},
        ${phone_number},
        ${venue_id},
        ${business_registration_number},
        ${business_registration_file},
        false,
        NOW()
      ) RETURNING id, email, venue_id, is_approved;
    `;

    return res.status(201).json({ 
      success: true, 
      message: '회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Venue manager registration error:', error);
    return res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
  }
};