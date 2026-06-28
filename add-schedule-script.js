const fetch = require('node-fetch');

const API_BASE_URL = 'https://barzidorock.vercel.app';
const ADMIN_TOKEN = 'admin-secret-token-2026'; // 임시 관리자 토큰

async function addSchedule() {
  const newSchedule = {
    venue_id: 'pet-sounds-001',
    event_date: '2026-06-28T19:00:00.000Z', // 2026년 6월 28일 오후 7시 (UTC)
    event_name: 'THE GREATEST MUSIC OF MICHAEL JACKSON',
    description: `마이클잭슨 17주기를 맞이하여 영원한 팝의 황제인 그의 음악과 영상을 중심으로 DJ High의 The Greatest Music of Michael Jackson을 진행합니다.
시대와 장르를 넘어 정말 수많은 아티스트들이 마이클잭슨으로부터 영향을 받았죠. 팝 관련 아티스트 중에선 영향받지 않은 아티스트를 찾기 어려울 정도입니다. 그가 남긴 많은 명곡들과 뮤직비디오, 라이브 영상들은 물론, 동시대 관련 장르 및 팝 아티스트의 음악도 빅스크린으로 함께 합니다.
무료입장 | 7PM-3AM`,
    poster_image: 'https://i.imgur.com/9y2J0g2.png', // 제공된 이미지 URL
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify(newSchedule),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create schedule');
    }

    console.log('Schedule created successfully:', result);
  } catch (error) {
    console.error('Error creating schedule:', error);
  }
}

addSchedule();