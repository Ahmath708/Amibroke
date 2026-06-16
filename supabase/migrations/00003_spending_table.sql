-- =============================================================================
-- 00003_spending_table — persistent named-spending breakdown (light user CRUD).
--   The user's mentioned spending categories (rent, takeout, …) get their own table so they
--   survive across roasts and the user can lightly edit them. Each roast merges its mentioned
--   categories in (see shared/spending.ts mergeSpending). Mirrors `tracked_subscriptions`.
--
--   Deliberately SIMPLE vs `debts`: every item is user-stated, so there is NO source/confidence
--   and NO soft-delete tombstone. It is a PARTIAL breakdown — sum(spending) does NOT have to equal
--   `financial_snapshots.monthly_expenses` (that stays the separate authoritative total). The
--   breakdown feeds no score, so there is no snapshot mirror. See docs/redesign §7.
-- =============================================================================

CREATE TABLE spending (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category    TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE spending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own spending"
  ON spending FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_spending_user ON spending(user_id);

CREATE TRIGGER update_spending_updated_at
  BEFORE UPDATE ON spending
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
