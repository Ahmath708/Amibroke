-- Active Plan (Model B, Phase 1): one committed, trackable 90-day plan per user.
-- See docs/active-plan-design.md. The plan's steps + per-step completion live in
-- `steps` (JSONB); `start_metrics` snapshots the source analysis's key numbers at
-- commit time so progress can be measured deterministically against later check-ins.

CREATE TABLE active_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  source_analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  horizon_days INTEGER NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  version INTEGER NOT NULL DEFAULT 1,
  overall_message TEXT,
  -- [{ id, week, title, description, category, impact, confidence, target?, status, completed_at? }]
  steps JSONB NOT NULL DEFAULT '[]',
  -- snapshot of the source analysis at commit: { debtTotal, liquidSavings, monthlyIncome, monthlySavings, score }
  start_metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most ONE active plan per user (the "current" plan). Completed/abandoned rows
-- are unbounded history.
CREATE UNIQUE INDEX active_plans_one_active_per_user
  ON active_plans (user_id) WHERE status = 'active';

ALTER TABLE active_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own active plans"
  ON active_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own active plans"
  ON active_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own active plans"
  ON active_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own active plans"
  ON active_plans FOR DELETE
  USING (auth.uid() = user_id);
