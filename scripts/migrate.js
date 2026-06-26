const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { sql } = require('@vercel/postgres');
const fs = require('fs');

async function runMigrations() {
  try {
    console.log('Starting migrations...');

    // 마이그레이션 디렉토리 경로
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
      if (file.endsWith('.js')) {
        console.log(`Running migration: ${file}`);
        const migration = require(path.join(migrationsDir, file));
        if (migration.up) {
          await migration.up(sql);
          console.log(`Migration ${file} completed successfully.`);
        } else {
          console.warn(`Migration ${file} has no 'up' function.`);
        }
      }
    }

    console.log('All migrations finished.');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    // Vercel Postgres는 연결 풀을 관리하므로 명시적으로 클라이언트를 종료할 필요가 없을 수 있습니다.
    // 하지만 로컬 개발 환경에서 스크립트가 종료되지 않는 경우를 대비하여 추가할 수 있습니다.
    // await sql.end(); // 필요한 경우 주석 해제
  }
}

runMigrations();