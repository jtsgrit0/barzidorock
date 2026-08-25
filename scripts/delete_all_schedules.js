require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
});

async function deleteAllSchedules() {
  try {
    console.log('모든 공연일정 삭제를 시작합니다...');
    console.log('연결하려는 DB:', process.env.DATABASE_URL ? 'DATABASE_URL' : 'POSTGRES_URL');
    const result = await pool.query('DELETE FROM schedules RETURNING *;');
    console.log(`✅ 성공적으로 ${result.rows.length}개의 공연일정을 삭제했습니다.`);
    if (result.rows.length > 0) {
      console.log('삭제된 일정 목록:');
      result.rows.forEach((row, i) => {
        console.log(`${i+1}. ${row.event_name} (ID: ${row.id})`);
      });
    }
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 공연일정 삭제 중 오류가 발생했습니다:', error);
    await pool.end();
    process.exit(1);
  }
}

deleteAllSchedules();