module.exports = async (req, res) => {
  const allowedOrigins = [
    'https://jtsgrit0.github.io',
    'http://localhost:3000',
    'https://barzidorock.vercel.app',
    'https://barzidorock-4n8edt15l-jtsgrit0s-projects.vercel.app' // 동적 Vercel URL 추가
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    // 관리자 이메일과 비밀번호 검증 (임시 하드코딩)
    const adminEmail = "admin@barzidorock.com";
    const adminPassword = "temp_password_1234";

    if (email === adminEmail && password === adminPassword) {
      // 로그인 성공 - 토큰 반환
      const adminToken = 'admin-secret-token-2026'; // 간단한 하드코딩 토큰
      return res.status(200).json({ success: true, message: 'Login successful', token: adminToken });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};