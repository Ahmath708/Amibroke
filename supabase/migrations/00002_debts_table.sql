-- =============================================================================
-- 00002_debts_table — itemized debts get their own table (source of truth).
--   Closes redesign #3 (payoff merge) + #5 (manual per-debt CRUD). See docs/debts-table.md.
--
--   Mirrors `tracked_subscriptions` (per-row RLS + CRUD) PLUS per-row provenance
--   (source/confidence) — debts, unlike subscriptions, are written by the roast LLM, so they
--   need a confidence-gated reconcile + a soft-delete tombstone (the §3.2 re-add guard).
--
--   `financial_snapshots.debts` (JSONB) + `debt_total` are KEPT as a denormalized MIRROR the
--   debts service syncs on every change, so existing read sites keep working unchanged. The
--   table is the source of truth; the mirror is a cheap-read cache.
-- =============================================================================

CREATE TABLE debts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  balance      NUMERIC NOT NULL,
  apr          NUMERIC,                          -- nullable; 0/unknown allowed
  min_payment  NUMERIC,
  kind         TEXT CHECK (kind IN ('credit_card','student_loan','auto','mortgage','medical','personal','other')),
  source       TEXT NOT NULL DEFAULT 'manual'    -- 'onboarding' | 'roast' | 'checkin' | 'manual'
    CHECK (source IN ('onboarding','roast','checkin','manual')),
  confidence   TEXT NOT NULL DEFAULT 'stated'    -- keep in sync with @shared/financialSnapshot Confidence
    CHECK (confidence IN ('estimated','low','medium','high','stated')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ                       -- soft-delete tombstone (docs/debts-table.md §3.2)
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own debts"
  ON debts FOR ALL USING (auth.uid() = user_id);

-- Active-list reads (getDebts / mirror / reconcile) only ever want non-tombstoned rows.
CREATE INDEX idx_debts_user_active ON debts(user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Backfill from the existing snapshot JSONB mirror ────────────────────────
-- Expand each snapshot's `debts` array into rows, carrying source/confidence from the
-- snapshot's `provenance.debts` (default roast/medium if absent). The JSONB column stays as the
-- mirror; the service overwrites it from the table on the next debt change.
INSERT INTO debts (user_id, name, balance, apr, min_payment, kind, source, confidence)
SELECT
  fs.user_id,
  d->>'name',
  COALESCE((d->>'balance')::numeric, 0),
  NULLIF(d->>'apr', '')::numeric,
  NULLIF(d->>'min_payment', '')::numeric,
  d->>'kind',
  COALESCE(fs.provenance->'debts'->>'source', 'roast'),
  COALESCE(fs.provenance->'debts'->>'confidence', 'medium')
FROM financial_snapshots fs
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(fs.debts, '[]'::jsonb)) AS d
WHERE jsonb_typeof(fs.debts) = 'array'
  AND COALESCE(d->>'name', '') <> ''
  AND COALESCE(fs.provenance->'debts'->>'source', 'roast') IN ('onboarding','roast','checkin','manual')
  AND COALESCE(fs.provenance->'debts'->>'confidence', 'medium') IN ('estimated','low','medium','high','stated');
