-- Add updated_at column and trigger to keep it current on updates
BEGIN;

ALTER TABLE IF EXISTS venue_managers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create a function to update `updated_at` on row updates
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires BEFORE UPDATE to set updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_set_updated_at_on_venue_managers'
  ) THEN
    CREATE TRIGGER trigger_set_updated_at_on_venue_managers
    BEFORE UPDATE ON venue_managers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

COMMIT;

-- Usage:
-- psql "$DATABASE_URL" -f database/migrations/20260706_add_updated_at_to_venue_managers.sql
