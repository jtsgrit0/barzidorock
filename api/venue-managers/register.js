const { sql } = require('@vercel/postgres');
const bcrypt = require('bcrypt');
const { put } = require('@vercel/blob');

const extractBusinessRegistrationNumber = (text) => {
  if (!text || typeof text !== 'string') return '미확인';
  const match = text.replace(/\s/g, '').match(/(\d{3})-?(\d{2})-?(\d{5})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '미확인';
};

const uploadBusinessRegistrationFile = async (base64File, email) => {
  const match = base64File.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = match ? match[1] : 'application/octet-stream';
  const data = match ? match[2] : base64File;
  const buffer = Buffer.from(data, 'base64');
  const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');

  const blob = await put(`business-registrations/${Date.now()}_${safeEmail}`, buffer, {
    access: 'public',
    contentType,
  });

  return blob.url;
};

const ensureVenueExists = async (venueId) => {
  const existing = await sql`SELECT id FROM venues WHERE id = ${venueId}`;
  if (existing.rows.length > 0) return;

  await sql`
    INSERT INTO venues (id, name, type, address, latitude, longitude, area, created_at)
    VALUES (
      ${venueId},
      ${'{"ko":"등록 대기"}'},
      ${'live_venue'},
      ${'{"ko":""}'},
      ${0},
      ${0},
      ${'unknown'},
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `;
};

module.exports = async (req, res) => {
  const allowedOrigins = [
    'https://jtsgrit0.github.io',
    'http://localhost:3000',
    'https://barzidorock.vercel.app',
    'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app',
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    const {
      email,
      password,
      phone_number,
      venue_id,
      business_registration_file,
      business_registration_text,
    } = req.body;

    if (!email || !password || !phone_number || !venue_id || !business_registration_file) {
      return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
    }

    const existingUser = await sql`
      SELECT id FROM venue_managers WHERE email = ${email}
    `;

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const business_registration_number = extractBusinessRegistrationNumber(business_registration_text);

    let fileUrl = null;
    try {
      fileUrl = await uploadBusinessRegistrationFile(business_registration_file, email);
    } catch (uploadError) {
      console.error('Business registration file upload failed:', uploadError);
    }

    try {
      await ensureVenueExists(venue_id);
    } catch (venueError) {
      console.error('ensureVenueExists failed:', venueError);
    }

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
        ${fileUrl},
        false,
        NOW()
      ) RETURNING id, email, venue_id, is_approved
    `;

    return res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Venue manager registration error:', error);
    return res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
  }
};
