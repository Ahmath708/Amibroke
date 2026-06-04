-- Phase 2a of the unified financial model (docs/unified-financial-model.md): the single
-- per-user "current financial state" every feature reads. Written by onboarding, each roast,
-- and each check-in. Flat metric columns (what features read) + a `provenance` JSONB
-- (per-field {value, source, confidence, updatedAt}) + a `debts` JSONB.

CREATE TABLE IF NOT EXISTS financial_snapshots (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  monthly_income        NUMERIC,
  monthly_expenses      NUMERIC,
  monthly_savings       NUMERIC,
  liquid_savings        NUMERIC,
  debt_total            NUMERIC,
  savings_rate          NUMERIC,
  emergency_fund_months NUMERIC,
  debt_to_income        NUMERIC,
  score                 NUMERIC,
  debts                 JSONB NOT NULL DEFAULT '[]',
  provenance            JSONB NOT NULL DEFAULT '{}',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own snapshot"   ON financial_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshot" ON financial_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshot" ON financial_snapshots FOR UPDATE USING (auth.uid() = user_id);

-- Eager grandfather backfill (#4): seed a snapshot for every existing user from their
-- MOST-RECENT analysis (a roast = their best-known current state). Users with no roasts get
-- no row (onboarding / their next roast seeds them). provenance marks these roast/high.
INSERT INTO financial_snapshots (
  user_id, monthly_income, monthly_expenses, monthly_savings, liquid_savings,
  debt_total, savings_rate, emergency_fund_months, debt_to_income, score, debts, provenance, updated_at)
SELECT DISTINCT ON (a.user_id)
  a.user_id, a.monthly_income, a.monthly_expenses, a.monthly_savings, a.liquid_savings,
  a.debt_total, a.savings_rate, a.emergency_fund_months, a.debt_to_income_ratio, a.score,
  COALESCE(a.debts, '[]'::jsonb),
  jsonb_build_object(
    'monthlyIncome',   jsonb_build_object('value', a.monthly_income,   'source', 'roast', 'confidence', 'high', 'updatedAt', a.created_at),
    'monthlyExpenses', jsonb_build_object('value', a.monthly_expenses, 'source', 'roast', 'confidence', 'high', 'updatedAt', a.created_at),
    'liquidSavings',   jsonb_build_object('value', a.liquid_savings,   'source', 'roast', 'confidence', 'high', 'updatedAt', a.created_at),
    'debts',           jsonb_build_object('value', COALESCE(a.debts, '[]'::jsonb), 'source', 'roast', 'confidence', 'high', 'updatedAt', a.created_at)
  ),
  a.created_at
FROM analyses a
ORDER BY a.user_id, a.created_at DESC
ON CONFLICT (user_id) DO NOTHING;
