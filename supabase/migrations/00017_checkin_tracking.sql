-- Monthly check-in tracking. A check-in is a recurring, user-curated progress
-- review: the user pins metrics/debts from an analysis (each with a baseline and
-- optional target) and updates their current values on a fixed monthly cadence
-- anchored to the user's first analysis.
--
-- Storage is additive + JSONB so the pinned-goal shape can evolve without further
-- migrations:
--   profiles.checkin_config  → { firstAnalyzeAt, anchorDay, goals: [...] }
--   check_ins.metrics        → per-event map of goalId → current value
-- Owner RLS on both tables already governs reads/writes.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS checkin_config JSONB;

ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS metrics JSONB;

NOTIFY pgrst, 'reload schema';
