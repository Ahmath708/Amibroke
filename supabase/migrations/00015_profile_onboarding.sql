-- Onboarding personalization (first-run): mark completion and store the optional
-- financial context collected on the Onboarding screen, used to seed analyses.
-- All additive/nullable; owner RLS on profiles already governs reads/writes.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarded                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ctx_state                  TEXT,
  ADD COLUMN IF NOT EXISTS ctx_income_bracket         TEXT,
  ADD COLUMN IF NOT EXISTS ctx_age_bracket            TEXT,
  ADD COLUMN IF NOT EXISTS ctx_living_situation       TEXT,
  ADD COLUMN IF NOT EXISTS ctx_employment_status      TEXT,
  ADD COLUMN IF NOT EXISTS ctx_debt_bracket           TEXT,
  ADD COLUMN IF NOT EXISTS ctx_liquid_savings_bracket TEXT;

NOTIFY pgrst, 'reload schema';
