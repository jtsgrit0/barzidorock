-- Fix null/empty created_at values for pending venue managers (venue_id: clubff-001-2026-0627)
BEGIN;

UPDATE venue_managers 
SET created_at = NOW()
WHERE venue_id = 'clubff-001-2026-0627' 
  AND (created_at IS NULL OR created_at::text = '' OR created_at::text = 'Invalid Date');

COMMIT;

-- Usage:
-- psql "$DATABASE_URL" -f database/migrations/20260706_fix_pending_venue_managers_dates.sql