-- The 90-day action plan no longer lives on the roast row. It belongs in `active_plans` (one
-- committed/tracked plan per user, keyed by source_analysis_id); a pre-commit preview is transient
-- client state and a re-open regenerates it. So `analyses.action_plan` is legacy — drop it.
-- (Reads/writes were repointed first: services/ai.ts no longer caches here, and the history list
-- derives `has_action_plan` from active_plans.source_analysis_id.)
ALTER TABLE analyses DROP COLUMN IF EXISTS action_plan;
