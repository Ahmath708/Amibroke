-- The analyses table (00001_initial.sql) predates several fields the analysis
-- pipeline now produces and saves (claudeApi.ts insert + getAnalysisById read).
-- Inserts were failing with PGRST204 "Could not find the 'avg_confidence'
-- column" because these columns were never added. Add them all here.
--
-- All columns are nullable (existing rows won't have values, and some inserts
-- omit fields). IF NOT EXISTS keeps this safe to re-run.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS liquid_savings        NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_debt_service  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_confidence        NUMERIC,
  ADD COLUMN IF NOT EXISTS score_modifier        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_modifier_reason TEXT,
  ADD COLUMN IF NOT EXISTS emotional_status      JSONB,
  ADD COLUMN IF NOT EXISTS top_fix               JSONB,
  ADD COLUMN IF NOT EXISTS cfpb_responses        JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS top_problems          JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS positive_behaviors    JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mentioned_spending    JSONB DEFAULT '[]';

-- Tell PostgREST to refresh its schema cache so the new columns are visible
-- immediately (otherwise the first requests can still hit a stale cache).
NOTIFY pgrst, 'reload schema';
