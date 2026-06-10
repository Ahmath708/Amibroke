# Schema v2 — consolidation plan

> Planning doc for a from-scratch DB rebuild. The hosted DB has **nothing valuable** (per Jason,
> 2026-06-10), so we can drop all tables and squash 00001–00026 into a small fresh baseline.
> **Not a Friday-demo task** — the demo is UI; this is a post-demo refactor. Tracks the target
> schema, open decisions, and the **butterfly effects** (every get/post/delete that must change).

## ⚠️ One hard constraint before any rebuild

**RLS makes denormalization load-bearing — joins do NOT solve it.** RLS is enforced per-row against
the *requesting user* on every table in a join (Supabase client queries run as the end user, not an
admin connection). The community feed is a cross-user public read; a `JOIN analyses`/`profiles` from
it returns rows only where `auth.uid() = user_id/id` — i.e. only the viewer's own — so other users'
roast content is silently filtered out. Even bypassing RLS would be wrong: `analyses` holds **private
financials** (`monthly_income`, `debts`) you must not expose publicly. So `community_posts` stays a
**denormalized public-safe projection** (`score/roast/summary/display_name`); it **cannot** be slimmed
to just `analysis_id`. (Hosted-DB reset to match the new baseline is **approved** — still rehearse on
**AmIBroke-staging** first.)

## Answers (resolved questions)

- **provenance** (`financial_snapshots`): per-field `{value, source, confidence, updatedAt}`; drives
  the confident-merge (overwrite only when incoming confidence ≥ stored) + the "~estimated" markers. **Keep.**
- **checkin_config**: stores the check-in cadence anchor + the goals being tracked; `check_ins.metrics`
  stores each month's values per goal. **Keep** (used by CheckinTrend, MonthlyCheckIn, DebtPayoff).
- **reaction_count**: keep only if we want server-side **trending** sort; per-emoji counts can come
  from aggregating `post_reactions` (public-readable). Collapse the dual `reactions` JSONB + `post_reactions` bookkeeping.
- **api_rate_limits**: **keep** — real throttling for the paid AI edge functions (rule #1). Investigate why it wasn't writing mocks-off (limiter failing open?).
- **user_subscriptions**: RevenueCat SDK is the client source of truth; the **server** mirror is still
  needed for `enforceEntitlement` (can't call the SDK server-side). Keep a lean mirror, rename, drop stripe vestiges.

## Target schema (per Jason's decisions)

| Table | Action | Fields (target) |
|---|---|---|
| **profiles** | slim | `id, username, first_name, last_name, avatar_url, onboarded, debt_strategy, created_at, updated_at` — **+ `preferred_tone`?** (see D1) **+ `checkin_config`?** (see D2). DROP: `display_name`, `monthly_income`, all `ctx_*`. |
| **financial_context** | **NEW** 1:1 → profiles | `user_id` PK, `state`, **`dob DATE`** (D3 — derive age/bracket), `living_situation`, `employment_status`, `income_bracket`, `debt_bracket`, `liquid_savings_bracket` (D4 — brackets persist here AND flow into the snapshot as `estimated` on every edit). Home for the FinancialContext form answers. |
| **financial_snapshots** | keep as-is | unchanged (incl. `provenance`). The current-state source of truth. |
| **analyses** | slim | `id, user_id, input_text, score, summary, roast` + the roast fields (metrics, `debts`, `insights`, `spending_breakdown`, `cfpb_responses`, `top_fix`, `emotional_status`, `mentioned_spending`, `share_captions`). DROP: `score_color`, `score_label` (both derive via `getScoreBand`), `is_paid` (no refs), `action_plan` (already dropped). |
| **action_plans** (rename of `active_plans`) | rename + lifecycle rework | `id, user_id, source_analysis_id (KEEP), started_at (server NOW()), ends_at (GENERATED = started_at + 90d), status ('active'\|'completed'\|'incomplete'), overall_message, steps, start_metrics, created_at, updated_at`. DROP `version`, `horizon_days`, and `abandoned` status. See **Plan lifecycle** below. |
| **community_posts** | **keep denormalized** (see constraint) | `id, user_id, analysis_id, display_name, score, roast, summary, created_at`. **D8: DROP `reactions` JSONB + `reaction_count`** (derive counts from `post_reactions`); DROP `score_label` (derive). FK `analysis_id` ON DELETE **CASCADE** (post has no standalone content). |
| **post_reactions** | keep — now the count source | unchanged. Per-emoji counts via aggregation (public-readable). Trade-off accepted: **no server-side trending sort** (drop the trending tab or re-derive later). |
| **tracked_subscriptions** (rename of `subscriptions`) | rename + adjust | `id, user_id, name, amount, category, billing_period (NEW — monthly/yearly/…), last_used, created_at, updated_at (NEW)`. DROP `icon` (frontend concern). Frontend add/edit must add **category** + **billing_period** inputs. |
| **plan_entitlements** (rename of `user_subscriptions`) | rename + trim | `user_id` PK, `plan, status, current_period_end, cancel_at_period_end, store, product_id, rc_entitlement, created_at, updated_at`. DROP `stripe_*`, `trial_end`. Server-side mirror for `enforceEntitlement`. |
| **payments** | **DROP** | Stripe legacy; only `gdpr.ts` references it → repoint GDPR. |
| **referrals** | **defer** | Not migrated; implement with the creator feature later. |
| **api_rate_limits** | keep | infra; unchanged. |

## Decisions

**Resolved:**
- **D1 ✅ keep `preferred_tone`** on profiles (alongside `debt_strategy`).
- **D3 ✅ `dob DATE`** in `financial_context`; derive age/bracket where needed (baselines).
- **D4 ✅ brackets persist in `financial_context` AND update the snapshot.** Today
  `FinancialContextScreen.save` writes `profiles.ctx_*` only — it does NOT touch the snapshot, so a
  later edit never propagates (onboarding seeds it once). Fix: both onboarding **and** the context
  edit call the snapshot merge with `estimated` confidence (so a real roast/`stated` value still wins
  via the confidence ladder).
- **D8 ✅ drop `reactions` JSONB + `reaction_count`**; derive per-emoji counts from `post_reactions`.
  Accept **no server-side trending sort**. `analysis_id` FK → ON DELETE CASCADE. Drop the
  `increment_reaction`/`decrement_reaction` RPCs.

- **D5 ✅ drop `score_label`** (from `analyses` AND `community_posts`) — derive via `getScoreBand(score)`
  in the frontend. Bonus: if the band thresholds/labels ever change, old rows aren't stale. Community
  feed already derives it; Results/Share switch from `analysis.scoreLabel` → `getScoreBand(score).label`.
- **D6 ✅ drop `version`.** Correction: it's not tied to abandon/recreate — the **revise-in-place** flow
  writes `version+1` (activePlan.ts:228/235), but nothing *reads* it for logic (write-only counter). Safe
  to drop; remove the increment from the revise path.
- **D7 ✅ keep abandoned rows, defer the UI.** Rows persist for free (unique index only constrains
  `status='active'`) and preserve real history tied to `source_analysis_id`. Don't add a DELETE; don't
  build the past-plans viewer now (YAGNI on the UI, keep the data/optionality).

- **D2 ✅ keep `checkin_config` on `profiles`** — one per-user settings blob alongside `debt_strategy`/`preferred_tone`; a table for a single JSONB column is over-normalization. profiles = identity + small sticky settings; demographics live in `financial_context`.

_All table-level decisions (D1–D8) settled._

## Note — is the `community_posts` denormalization actually a smell?

Not really. The anti-pattern is denormalizing **mutable** data that drifts out of sync. A roast is an
**immutable published snapshot** — it never changes after creation — so there's nothing to drift, and
capturing the content at share-time is the *correct* model (a community post should show the roast as
it was, even if the source analysis is later deleted — hence ON DELETE CASCADE keeps it coherent).
Storage is negligible: only *shared* analyses, ~<1KB each (score int + roast ≤240 + summary ≤400 +
name). If storage ever bites at scale, the lever is **pruning old/low-engagement posts**, not
normalizing into a join the public feed's RLS can't satisfy.

## Plan lifecycle (action_plans v2)

Fixed 90-day windows that stay constant across in-place revisions — the basis for the future
"how far you've come" feature (deterministic diff of current snapshot vs the arc's `start_metrics`).

- **Window:** `started_at` server-set (`NOW()`), `ends_at` GENERATED `started_at + interval '90 days'`
  (can't drift; drop `horizon_days`). Timestamps never client-supplied.
- **Status:** `active` (1 max) · `completed` (all steps done, even early) · `incomplete` (window
  elapsed, not finished). `abandoned` removed (its old meaning, "superseded," disappears under
  revise-in-place).
- **Creation logic is status-aware (not pure time):**
  - revise in place ⟺ an **active** plan exists AND `now < ends_at` → UPDATE same row (window kept).
  - otherwise (no plan | completed | incomplete | window elapsed) → INSERT a **fresh** 90-day arc.
  - early completion → plan is `completed` (not active) → next create gets a fresh window (fixes the
    "leftover window" edge case).
- **Window-end is lazy** (no cron): on fetch/create, if `now >= ends_at`, mark the old plan
  `completed`/`incomplete` and start a new arc. Stale-plan nudge keys off **both** `ends_at`
  (time-elapsed) and snapshot-staleness (numbers changed).
- **Completion funnel (v1, post-demo):** today nothing marks `completed` and creation doesn't gate on
  changed inputs, so an identical plan can be regenerated. Key fact: **only a check-in or a fresh
  *typed* roast moves the snapshot** — completing a plan/steps doesn't, and a snapshot **re-score**
  (`buildRescoreInput`) doesn't either (it rebuilds from the unchanged snapshot → same plan). So on
  completion:
  - **Primary CTA = check-in** (the structured snapshot driver). Secondary = "something bigger
    changed? start a new roast" → the **composer** (new free-text), NOT the re-score path. Don't
    force-redirect — just make check-in the obvious next step on the celebration screen.
  - **Gate next-plan generation on snapshot movement vs the completed plan's `start_metrics`**, not on
    parsing the free-text. No movement → "Build my next plan" disabled with a hint ("check in or tell
    me what's changed first"). Deterministic, reuses `start_metrics`, avoids a classifier and the
    "I finished the plan" non-input. Copy asks *"what's changed about your money?"*, never about the plan.
  - Overlaps roast-plan-rework **Phase 4** (check-in bridge). NOT needed for the Friday demo.
- **Current state to migrate from:** `activePlan.ts` only sets `active`→`abandoned` (on supersede),
  never `completed`; create *always* abandons-old + inserts-new. v2 must branch (revise-in-place vs
  new-arc) and add the `completed` transition.

## Butterfly-effects map (code that changes per table change)

- **`tables.ts`** — `TABLES.subscriptions`→`tracked_subscriptions`, `user_subscriptions`→`plan_entitlements`, `active_plans`→`action_plans`; drop `payments`; update `HISTORY_COLUMNS` (drop `score_color`; add `input_text` for the AllAnalyses preview).
- **profiles slim** → `profile.ts` (`updateProfile`/`getProfile` field lists), `AuthContext.checkProfile`, the `handle_new_user` trigger (stop writing `display_name`), Dashboard greeting (drop `display_name` fallback), OnboardingScreen (write context to `financial_context`, not `profiles`; stop writing `monthly_income`/`ctx_*`).
- **financial_context (new)** → `FinancialContextForm`/`FinancialContextScreen` (read/write new table; **DOB date-picker instead of age-bracket chips** — D3), OnboardingScreen (**collect DOB**; write context to the new table), analyze edge fn + `buildRescoreInput` (derive `ageBracket` from `dob` for `userContext` baselines).
- **brackets → snapshot (D4)** → `FinancialContextScreen.save` currently writes profiles only; make it also call `seedSnapshotFromOnboarding`/`mergeSnapshot` (`estimated`) so context edits update the snapshot — same merge onboarding already uses.
- **analyses slim** → `analyses.ts` (`saveAnalysis` insert; `getAnalysisById` map — drop `score_color` + `score_label`), Results/Share/Profile (`analysis.scoreColor ?? getScoreBand(...)` → just `getScoreBand`; `analysis.scoreLabel` → `getScoreBand(score).label`), `sampleAnalysis` fixture, `types/index.ts` (drop `scoreColor`/`scoreLabel`).
- **action_plans rename + lifecycle** → `activePlan.ts` (table name; drop `version`/`horizon_days`; add `ends_at`; **branch create into revise-in-place vs new-arc** instead of always abandon+insert at 156–159; add the `completed` transition + status enum `active|completed|incomplete`), `planProgress`/`shouldRevisePlan` (key staleness off `ends_at` too), ActionPlan/Tools/Notifications/MonthlyCheckIn, `revise-plan` edge fn (stop bumping version), **completion funnel** → MonthlyCheckIn/Analyze routing (Phase 4).
- **community_posts (D8)** → `community.ts` (drop `reactions` from feed select + `shareRoast`; **remove the trending order-by `reaction_count`** → drop/replace the trending tab; per-emoji counts now via `post_reactions` aggregation), `CommunityFeedScreen` (reaction display from aggregated counts; show only emoji with ≥1), `utils/reactions`, drop `increment_reaction`/`decrement_reaction` RPCs, `creator.ts` (`getCreatorStats` "Views/Shares" proxies read `reactions` — re-derive or accept change).
- **tracked_subscriptions** → `subscriptionAudit.ts`, `SubscriptionAuditScreen` (add category + billing_period inputs), `creator`/re-roast paths that weigh subscriptions.
- **plan_entitlements** → `subscriptions.ts` (tier logic), `enforceEntitlement` (`_shared/entitlement.ts`), `revenuecat-webhook` (upsert target), `useSubscription`.
- **payments drop** → `gdpr.ts` (remove from export + delete lists).
- **types/index.ts** — every interface above (Profile, AnalysisHistoryItem, CommunityPost, etc.).
- **GDPR** — export/delete lists must match the final table set.
- **Docs to update AT CUTOVER (not just code):** `CLAUDE.md` (migration list, repo-structure
  `src/services` descriptions, the Core-systems table names: `subscriptions`/`user_subscriptions`/
  `active_plans` → new names, drop `payments`, add `financial_context`), `docs/demo-checklist.md`
  (table/field references), `docs/DECISIONS.md` (log the rebuild), and reconcile
  `docs/roast-plan-rework.md` (its plan-lifecycle section is superseded — see below).
