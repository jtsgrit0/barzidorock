const { sql } = require('@vercel/postgres');
const bcrypt = require('bcrypt');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: '토큰과 새 비밀번호는 필수입니다.' });
  }

  // 비밀번호 길이 검사
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
  }

  try {
    // 데이터베이스에서 유효한 토큰을 가진 사용자 찾기
    const result = await sql`
      SELECT * FROM venue_managers 
      WHERE reset_password_token = ${token} 
      AND reset_password_expires > NOW()
    `;

    if (result.rows.length === 0) {
      return res.status(400).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    }

    const user = result.rows[0];

    // 새 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트 및 토큰 무효화
    await sql`
      UPDATE venue_managers 
      SET password = ${hashedPassword},
          reset_password_token = NULL,
          reset_password_expires = NULL
      WHERE id = ${user.id}
    `;

    res.status(200).json({ message: '비밀번호가 성공적으로 재설정되었습니다.' });
  } catch (error) {
    console.error('비밀번호 재설정 중 오류 발생:', error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
};