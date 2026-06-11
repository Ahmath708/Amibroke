-- =============================================================================
-- Schema v2 — squashed baseline migration  (FINALIZED — not yet applied; post-demo cutover)
-- =============================================================================
-- Replaces the squash target of live migrations 00001–00026 with the Schema v2
-- target schema (docs/schema-v2.md). This file lives in supabase/migrations.v2/
-- so it stays SEPARATE from the live supabase/migrations/ state (kept intact for
-- the Friday demo). Nothing here is applied until the post-demo rebuild cutover.
--
-- =============================================================================
-- RESOLVED DECISIONS  (locked; see docs/schema-v2.md) — everything below was
-- confirmed as-drafted EXCEPT the deltas explicitly marked RESOLVED (#4/#9/#12/#16).
-- =============================================================================
-- 1. EXACT MONTHLY INCOME has NO column anywhere in v2. The slim `profiles` drops
--    `monthly_income` (00021) and `financial_context` only holds the coarse
--    `income_bracket`. Per schema-v2 the exact figure is meant to be derived into
--    `financial_snapshots.monthly_income` as a `stated` provenance value (the top
--    of the confidence ladder). ASSUMPTION: no DB column is added for it — the
--    onboarding/context-edit code paths must write it straight to the snapshot via
--    mergeSnapshot(confidence='stated'). Flagging in case you want a staging column.
--
-- 2. `financial_context` column TYPES are inferred. `dob` is DATE (D3, explicit).
--    `state` / `living_situation` / `employment_status` / `income_bracket` /
--    `debt_bracket` / `liquid_savings_bracket` are all modeled as TEXT (they mirror
--    the old `ctx_*` TEXT columns, which were free-form bracket strings). No CHECK
--    constraints / enums added — the bracket vocabularies live in app config, not
--    the DB today. Confirm whether you want DB-level CHECKs on the brackets/state.
--
-- 3. `financial_context` RLS: modeled owner-private (auth.uid() = user_id), same as
--    profiles/snapshots. ASSUMPTION: it is NOT public-readable (it holds private
--    demographics: dob, employment, brackets). Only the owner reads/writes.
--    No INSERT-by-trigger: assumed the app upserts the row on first context save
--    (NOT seeded by handle_new_user). Confirm if you'd rather the auth trigger
--    create an empty financial_context row on signup.
--
-- 4. `analyses` SLIM scope is ambiguous. schema-v2 lists the keepers as the roast
--    fields (metrics, debts, insights, spending_breakdown, cfpb_responses, top_fix,
--    emotional_status, mentioned_spending, share_captions) and DROPS score_color /
--    score_label / is_paid / action_plan. It does NOT mention the OTHER extended
--    columns added in 00013: top_problems, positive_behaviors, score_modifier,
--    score_modifier_reason, avg_confidence, monthly_debt_service, liquid_savings.
--    RESOLVED: KEEP them — immutable AI/scoring output, not derivable. (score_color/
--    score_label are the ones dropped → derived via getScoreBand: no stale rows, no
--    migration when band ranges move.)
--    Also: the "metrics" are kept as the flat numeric columns (income/expenses/
--    savings/debt_total/savings_rate/emergency_fund_months/debt_to_income_ratio),
--    matching the snapshot's flat shape — NOT folded into a single JSONB.
--
-- 5. `action_plans.status` modeled as a TEXT + CHECK ('active','completed',
--    'incomplete') rather than a real Postgres ENUM type (matches the existing
--    active_plans pattern; easier to alter). schema-v2 says "status enum" — confirm
--    TEXT+CHECK is acceptable vs. a CREATE TYPE enum.
--
-- 6. `action_plans.ends_at` is a GENERATED STORED column = started_at + 90 days.
--    `started_at` defaults to NOW() and is documented as never client-supplied —
--    but nothing in the DB *prevents* a client INSERT from supplying started_at
--    (RLS allows owner inserts). ASSUMPTION: enforcing "server-set only" is the
--    app/edge-fn's job, not a DB trigger. Flag if you want a BEFORE INSERT trigger
--    to force started_at = NOW().
--
-- 7. The "lazy window-end" transition (now >= ends_at → mark completed/incomplete,
--    start a new arc) is application logic (activePlan.ts), NOT a DB cron/trigger —
--    schema-v2 explicitly says "no cron". This baseline only provides the columns +
--    the one-active-per-user unique index; the branching create logic lives in code.
--
-- 8. RESOLVED: `tracked_subscriptions.billing_period` is a CHECK enum, DEFAULT 'monthly',
--    values weekly|monthly|quarterly|semiannual|yearly — kept in sync with the single source of
--    truth @shared/billingPeriod.ts (BILLING_PERIODS + toMonthly() for the audit's $/mo math).
--
-- 9. RESOLVED: plan_entitlements.status CHECK trimmed to (active|trialing|past_due|canceled)
--    — exactly what revenuecat-webhook writes + entitlement.ts/subscriptions.ts read
--    (incomplete/incomplete_expired/paused dropped as dead). plan CHECK
--    ('action_plan','deep_dive'). SELECT-only RLS — the service-role webhook writes here.
--
-- 10. `community_posts.display_name` / `score` / `roast` / `summary` are the
--     denormalized public-safe projection (load-bearing under RLS — see schema-v2's
--     hard constraint). NOT NULL kept on display_name/roast/summary/score.
--     `analysis_id` FK changed to ON DELETE CASCADE (D8) — deleting the source
--     analysis deletes the post. `score_label` / `reactions` / `reaction_count`
--     dropped (D5/D8). Server-side trending is restored via the `community_posts_with_counts`
--     VIEW (live reaction_count aggregate) instead of a denormalized column + sync trigger.
--
-- 11. `post_reactions` emoji CHECK whitelist carried forward verbatim
--     ('🔥','😭','💀','💯','😂'). The reaction-count SYNC TRIGGER + sync_reaction_counts()
--     are DROPPED (no reactions JSONB to maintain — D8). Per-emoji counts are now
--     derived by aggregating post_reactions client/edge-side.
--
-- 12. RESOLVED: check_ins is JSONB-ONLY — flat income/expenses/savings/debt DROPPED; all
--     figures live in `metrics` (point-in-time history; the snapshot keeps only current
--     state). The read path (checkins.ts, MonthlyCheckIn prefill) moves to metrics->> at cutover.
--
-- 13. RPCs carried forward: check_rate_limit, cleanup_rate_limits (00009),
--     set_username (00010), is_username_available (00016). DROPPED:
--     increment_reaction / decrement_reaction (00003/00011, D8). The
--     update_updated_at() helper trigger fn is carried forward and attached to every
--     table with an updated_at column.
--
-- 14. Storage: the `avatars` public bucket + its 4 object policies (00006) are
--     carried forward verbatim.
--
-- 15. DROPPED tables (not created here): payments (Stripe legacy), referrals
--     (deferred to the creator feature). GDPR export/delete lists must be repointed
--     in code (gdpr.ts) — out of scope for this SQL.
--
-- 16. RESOLVED: handle_new_user() writes ONLY (id). username stays NULL (onboarding claims it
--     via set_username — Phase 1); preferred_tone/debt_strategy/onboarded use column DEFAULTs.
--
-- ⚠ BEFORE APPLY:
--   · financial_snapshots ✓ VERIFIED — matches live 00022 verbatim (flat values + provenance JSONB).
--   · The code-side butterfly map (tables.ts renames, services, edge fns, gdpr.ts, and the
--     check_ins metrics-JSONB read path) is OUT OF SCOPE for this SQL — done at cutover.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Shared helper: auto-update `updated_at` on row UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- profiles  (SLIM — identity + small sticky settings)
--   DROPPED vs v1: display_name, monthly_income, all ctx_* (moved to
--   financial_context), score_color/label (n/a). KEEPS: preferred_tone (D1),
--   checkin_config (D2), debt_strategy.
-- =============================================================================
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username       TEXT UNIQUE,                              -- nullable; set via set_username
  first_name     TEXT,
  last_name      TEXT,
  avatar_url     TEXT,
  onboarded      BOOLEAN NOT NULL DEFAULT false,
  debt_strategy  TEXT NOT NULL DEFAULT 'avalanche',        -- sticky (avalanche/snowball)
  preferred_tone TEXT NOT NULL DEFAULT 'savage',           -- sticky roast voice (D1)
  checkin_config JSONB,                                    -- { firstAnalyzeAt, anchorDay, goals[] } (D2)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- financial_context  (NEW — 1:1 → profiles)
--   Home for the FinancialContext form answers (the old ctx_* set), plus dob.
--   D3: store raw dob DATE, never a derived age (compute age at runtime).
--   D4: brackets persist HERE and also flow into financial_snapshots as
--       `estimated` on every edit (app/edge-fn responsibility, not this SQL).
-- =============================================================================
CREATE TABLE financial_context (
  user_id                 UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  state                   TEXT,
  dob                     DATE,                            -- raw birthday (D3)
  living_situation        TEXT,
  employment_status       TEXT,
  income_bracket          TEXT,
  debt_bracket            TEXT,
  liquid_savings_bracket  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financial_context ENABLE ROW LEVEL SECURITY;

-- Owner-private: holds private demographics (dob, employment, brackets).
CREATE POLICY "Users can view own context"
  ON financial_context FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own context"
  ON financial_context FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own context"
  ON financial_context FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_financial_context_updated_at
  BEFORE UPDATE ON financial_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- financial_snapshots  (UNCHANGED from 00022 — the current-state source of truth)
--   Flat metric columns (what features read) + provenance JSONB (per-field
--   {value, source, confidence, updatedAt}) + debts JSONB.
--   NOTE: exact monthly income lands HERE as a `stated` provenance value (OQ #1).
-- =============================================================================
CREATE TABLE financial_snapshots (
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

CREATE POLICY "Users can view own snapshot"
  ON financial_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshot"
  ON financial_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshot"
  ON financial_snapshots FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_financial_snapshots_updated_at
  BEFORE UPDATE ON financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- analyses  (SLIM — immutable roast history)
--   DROPPED vs v1: score_color, score_label (derive via getScoreBand), is_paid,
--   action_plan (already dropped 00026). KEEPS the roast fields + flat metrics.
--   See OQ #4 re: the unlisted 00013 extended columns (kept here to be safe).
-- =============================================================================
CREATE TABLE analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES profiles(id) ON DELETE CASCADE,
  input_text            TEXT NOT NULL,
  score                 INTEGER NOT NULL,
  summary               TEXT NOT NULL,
  roast                 TEXT NOT NULL,

  -- flat metrics (mirror the snapshot's flat shape)
  monthly_income        NUMERIC NOT NULL,
  monthly_expenses      NUMERIC NOT NULL,
  monthly_savings       NUMERIC NOT NULL,
  debt_total            NUMERIC NOT NULL,
  savings_rate          NUMERIC NOT NULL,
  emergency_fund_months NUMERIC NOT NULL,
  debt_to_income_ratio  NUMERIC NOT NULL,
  liquid_savings        NUMERIC,                           -- 00013
  monthly_debt_service  NUMERIC,                           -- 00013

  -- roast content / breakdowns
  spending_breakdown    JSONB NOT NULL DEFAULT '[]',
  debts                 JSONB NOT NULL DEFAULT '[]',
  insights              JSONB NOT NULL DEFAULT '[]',
  cfpb_responses        JSONB DEFAULT '[]',                -- 00013
  emotional_status      JSONB,                             -- 00013
  top_fix               JSONB,                             -- 00013
  mentioned_spending    JSONB DEFAULT '[]',                -- 00013
  share_captions        JSONB,                             -- 00008

  -- additional pipeline outputs (00013) — kept; see OQ #4
  avg_confidence        NUMERIC,
  score_modifier        NUMERIC DEFAULT 0,
  score_modifier_reason TEXT,
  top_problems          JSONB DEFAULT '[]',
  positive_behaviors    JSONB DEFAULT '[]',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own analyses"
  ON analyses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses"
  ON analyses FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_analyses_user_id    ON analyses(user_id);
CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);


-- =============================================================================
-- action_plans  (rename of active_plans + lifecycle rework)
--   DROPPED vs v1: version (D6), horizon_days (now derived), 'abandoned' status.
--   NEW: ends_at GENERATED = started_at + 90 days. Status enum active|completed|
--   incomplete (TEXT+CHECK — OQ #5). One ACTIVE plan per user (unique index only
--   constrains status='active'; completed/incomplete rows are unbounded history).
--   Branching create logic (revise-in-place vs new-arc) lives in app code (OQ #7).
-- =============================================================================
CREATE TABLE action_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  source_analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),                       -- server-set (OQ #6); client omits it
  ends_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '90 days'), -- = started_at + 90d (both default to the same txn NOW()); NOT GENERATED — timestamptz+interval isn't immutable
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'completed', 'incomplete')),
  overall_message    TEXT,
  -- [{ id, week, title, description, category, impact, confidence, target?, status, completed_at? }]
  steps              JSONB NOT NULL DEFAULT '[]',
  -- snapshot at arc start: { debtTotal, liquidSavings, monthlyIncome, monthlySavings, score }
  start_metrics      JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most ONE active plan per user.
CREATE UNIQUE INDEX action_plans_one_active_per_user
  ON action_plans (user_id) WHERE status = 'active';

ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own action plans"
  ON action_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own action plans"
  ON action_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own action plans"
  ON action_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own action plans"
  ON action_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_action_plans_updated_at
  BEFORE UPDATE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- community_posts  (DENORMALIZED public-safe projection — load-bearing under RLS)
--   DROPPED vs v1: reactions JSONB, reaction_count (D8), score_label (D5).
--   analysis_id FK → ON DELETE CASCADE (D8): the post has no standalone content.
--   PUBLIC-READ + owner-write. Posting still gated on having set a username.
-- =============================================================================
CREATE TABLE community_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  analysis_id  UUID REFERENCES analyses(id) ON DELETE CASCADE,   -- D8: CASCADE
  display_name TEXT NOT NULL,
  score        INTEGER NOT NULL,
  roast        TEXT NOT NULL,
  summary      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_post_per_analysis UNIQUE (analysis_id)      -- 1:1 post per analysis
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view community posts"
  ON community_posts FOR SELECT USING (true);
-- Posting requires a username (community identity gate, carried from 00010).
CREATE POLICY "Users can insert own community posts (username required)"
  ON community_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username IS NOT NULL)
  );
CREATE POLICY "Users can delete own community posts"
  ON community_posts FOR DELETE USING (auth.uid() = user_id);

-- Feed sort indexes: recent + lowest-score. NO trending index (no reaction_count).
CREATE INDEX idx_cp_recent ON community_posts (created_at DESC);
CREATE INDEX idx_cp_lowest ON community_posts (score ASC, created_at ASC);


-- =============================================================================
-- post_reactions  (the per-emoji count source — public-read + owner-write)
--   No more reaction-sync trigger / reactions JSONB (D8): counts derive by
--   aggregating this table (public-readable). Emoji whitelist carried forward.
-- =============================================================================
CREATE TABLE post_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id, emoji),
  CONSTRAINT post_reactions_emoji_check CHECK (emoji IN ('🔥','😭','💀','💯','😂'))
);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON post_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert reactions"
  ON post_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username IS NOT NULL)
  );
CREATE POLICY "Users can delete own reactions"
  ON post_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);


-- =============================================================================
-- community_posts_with_counts  (VIEW) — trending source: posts + live reaction_count
--   Aggregates post_reactions per post on the fly — no denormalized counter / sync trigger (D8).
--   security_invoker → the underlying tables' RLS (both public-read) applies to the caller.
--   GROUP BY the PK lets us SELECT cp.* alongside the count (functional dependency on community_posts.id).
--   The feed's keyset pagination orders/filters by reaction_count just like the old column.
-- =============================================================================
CREATE VIEW community_posts_with_counts WITH (security_invoker = true) AS
  SELECT cp.*, COALESCE(COUNT(pr.id), 0)::int AS reaction_count
  FROM community_posts cp
  LEFT JOIN post_reactions pr ON pr.post_id = cp.id
  GROUP BY cp.id;


-- =============================================================================
-- tracked_subscriptions  (rename of subscriptions — manual subscription audit)
--   DROPPED vs v1: icon (frontend concern). NEW: billing_period, updated_at.
-- =============================================================================
CREATE TABLE tracked_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name           TEXT NOT NULL,
  amount         NUMERIC NOT NULL,
  category       TEXT,
  billing_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly')), -- keep in sync with @shared/billingPeriod.ts
  last_used      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()        -- NEW
);

ALTER TABLE tracked_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tracked subscriptions"
  ON tracked_subscriptions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_tracked_subscriptions_user ON tracked_subscriptions(user_id);

CREATE TRIGGER update_tracked_subscriptions_updated_at
  BEFORE UPDATE ON tracked_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- plan_entitlements  (rename of user_subscriptions — server-side entitlement mirror)
--   DROPPED vs v1: stripe_customer_id, stripe_subscription_id, trial_end.
--   SELECT-only RLS for clients; only the revenuecat-webhook (service role) writes.
-- =============================================================================
CREATE TABLE plan_entitlements (
  user_id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  plan                 TEXT CHECK (plan IN ('action_plan', 'deep_dive')),
  status               TEXT CHECK (status IN ('active','trialing','past_due','canceled')), -- the set revenuecat-webhook writes + entitlement reads (OQ #9)
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  store                TEXT,                               -- 'app_store' | 'play_store'
  product_id           TEXT,                               -- store product identifier
  rc_entitlement       TEXT,                               -- granting entitlement id
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plan_entitlements ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner; writes are service-role only (the webhook).
CREATE POLICY "Users can view own entitlement"
  ON plan_entitlements FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_plan_entitlements_status ON plan_entitlements(status);

CREATE TRIGGER update_plan_entitlements_updated_at
  BEFORE UPDATE ON plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- check_ins  (monthly check-in time-series)
--   Carried forward from 00002 + 00017 (metrics JSONB) + 00023 (reflection).
--   OQ #10 RESOLVED: JSONB-only. The flat income/expenses/savings/debt columns are dropped — all
--   recorded figures live in `metrics` (the immutable point-in-time history). The snapshot keeps
--   ONLY current state (no history), so the check-in must freeze its own copy here.
-- =============================================================================
CREATE TABLE check_ins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mood       INTEGER NOT NULL,
  notes      TEXT,
  metrics    JSONB,                                        -- all recorded values this check-in (income/expenses/savings/debt + per-goal), keyed; goal DEFINITIONS live in profiles.checkin_config
  reflection TEXT,                                         -- 00023: per-check-in Haiku note
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own check-ins"
  ON check_ins FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_check_ins_user    ON check_ins(user_id);
CREATE INDEX idx_check_ins_created ON check_ins(created_at DESC);


-- =============================================================================
-- api_rate_limits  (UNCHANGED — infra throttling for the paid AI edge functions)
-- =============================================================================
CREATE TABLE api_rate_limits (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
-- NOTE: no RLS — accessed only via the SECURITY DEFINER check_rate_limit RPC
-- from edge functions (service role). Matches the live 00009 behavior.


-- =============================================================================
-- RPCs (carried forward)
-- =============================================================================

-- Rate limiting (00009) ------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(p_key text, p_max int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count  int;
BEGIN
  DELETE FROM api_rate_limits WHERE bucket_key = p_key AND window_start < v_window;
  INSERT INTO api_rate_limits (bucket_key, window_start, request_count)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 day';
$$;

-- Username claim (00010) -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_username(p_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  p_username := lower(trim(p_username));
  IF length(p_username) < 3 OR length(p_username) > 24 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_length');
  END IF;
  IF p_username !~ '^[a-z0-9_]+$' THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_charset');
  END IF;

  BEGIN
    UPDATE profiles SET username = p_username WHERE id = v_caller_id;
    RETURN json_build_object('ok', true, 'username', p_username);
  EXCEPTION
    WHEN unique_violation THEN
      RETURN json_build_object('ok', false, 'error', 'taken');
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_username(text) TO authenticated;

-- Anonymous username-availability check for the signup form (00016) ----------
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE lower(username) = lower(trim(p_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- NOTE: increment_reaction / decrement_reaction (00003/00011) and the
-- sync_reaction_counts() trigger are intentionally NOT carried forward (D8).


-- =============================================================================
-- Auth trigger: create a slim profile row on signup (00005, slimmed per v2).
--   Writes ONLY (id). No display_name / monthly_income / ctx_*. username stays
--   NULL (claimed later via set_username); other fields use column DEFAULTs.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- Storage: public `avatars` bucket + object policies (00006, carried forward)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Select Avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users Can Insert Own Avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users Can Update Own Avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users Can Delete Own Avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- Refresh PostgREST schema cache so new tables/columns are visible immediately.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END baseline
-- =============================================================================
