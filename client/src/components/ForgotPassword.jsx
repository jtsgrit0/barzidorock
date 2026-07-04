import React, { useState } from 'react';
import './ForgotPassword.css'; // CSS 파일도 함께 생성할 예정

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://barzidorock.vercel.app';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || '비밀번호 재설정 지침이 이메일로 전송되었습니다.');
      } else {
        setError(data.error || '비밀번호 재설정 요청에 실패했습니다.');
      }
    } catch (err) {
      setError('서버와 통신 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <h2>비밀번호 찾기</h2>
      <form onSubmit={handleSubmit} className="forgot-password-form">
        <div className="form-group">
          <label htmlFor="email">이메일 주소</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="등록된 이메일 주소를 입력해주세요"
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? '전송 중...' : '비밀번호 재설정 링크 받기'}
        </button>
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
};

export default ForgotPassword;