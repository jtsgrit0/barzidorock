const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

module.exports = async (req, res) => {
  // CORS 설정 - 로컬 개발, GitHub Pages, Vercel 모두 허용
  const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
const allowedOrigins = ['https://jtsgrit0.github.io', 'http://localhost:3000', 'https://barzidorock.vercel.app'];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
res.setHeader('Access-Control-Allow-Credentials', 'true');

if (req.method === 'OPTIONS') {
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(200).end();
}    // 인증 코드 조회
    const result = await pool.query(
      'SELECT * FROM email_verifications WHERE email = $1 AND code = $2',
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: '유효하지 않은 인증 코드입니다' });
    }

    const verification = result.rows[0];
    const now = new Date();

    // 만료 시간 확인
    if (new Date(verification.expires_at) < now) {
      // 만료된 코드 삭제
      await pool.query(
        'DELETE FROM email_verifications WHERE id = $1',
        [verification.id]
      );
      return res.status(400).json({ error: '인증 코드가 만료되었습니다' });
    }

    // 사용된 인증 코드 삭제
    await pool.query(
      'DELETE FROM email_verifications WHERE id = $1',
      [verification.id]
    );

    return res.status(200).json({ message: '이메일 인증이 완료되었습니다', verified: true });
  } catch (error) {
    console.error('이메일 인증 확인 오류:', error);
    return res.status(500).json({ error: '인증 확인에 실패했습니다' });
  }
};