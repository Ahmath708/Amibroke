# Project Status — Am I Broke?

> **Read this first, every session.** It's the source of truth for *where we are right now*;
> `CLAUDE.md` is the source of truth for *how things are built*. When you finish meaningful work,
> append a one-line entry to the Session Log at the bottom. Keep this thin — link the living
> trackers below, don't duplicate them.

**Last updated:** 2026-06-10 · **Active branch:** `better-workflow` (off `redesign`)

---

## Sources of truth (living docs — read the relevant one before touching its area)

| Doc | Owns |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | How the repo is built — rules, structure, conventions, gotchas |
| [`docs/DECISIONS.md`](DECISIONS.md) | Decision & iteration log (why things are the way they are) |
| [`docs/design-doctrine.md`](design-doctrine.md) | All frontend work — brand, tokens, motion, the `/audit-screen` rubric |
| [`docs/roast-plan-rework.md`](roast-plan-rework.md) | Living tracker: roast/plan persistence rework (phased) |
| [`docs/demo-checklist.md`](demo-checklist.md) | Fresh-account end-to-end QA checklist |
| [`docs/unified-financial-model.md`](unified-financial-model.md) | The snapshot / analyses / check-ins model |
| [`docs/three-day-enforcement.md`](three-day-enforcement.md) | 3-day-access paywall enforcement plan |
| [`docs/schema-v2.md`](schema-v2.md) | DB rebuild/consolidation plan — target schema, open decisions (D1–D8), butterfly-effects map |

## In flight

- **Workflow system (this branch).** Making fresh/cross-session work reliable: this status doc +
  an operating loop in `CLAUDE.md` + a `CLAUDE.md` staleness refresh. Remaining/optional: a Stop-hook
  auto-checkpoint and a skills-as-table upgrade (both unconfirmed).
- **Onboarding "Voice on Polish"** *(planned, not started).* Motion floor (PressableScale / staggered
  entrances / haptics, reduce-motion honored) + a neutral "cheeky host" voice that teases the roast
  without committing to the savage tone (tone is user-selectable later). Plan agreed; copy table +
  `OnboardingScreen.tsx` rework pending. Can't demo here (no Mac).
- **Roast / plan rework** — see [`docs/roast-plan-rework.md`](roast-plan-rework.md). Phases 1, 2, and the
  plan-UX overhaul are ✅ done; Phases 3 (re-roast model), 4 (plan-progress feedback), 5 (estimate
  labeling), 6 (UI papercuts) pending.
- **3-day-access enforcement** — built but flag-gated **off** (`FEATURES.PAYWALL_ENFORCEMENT`).
  Remaining: coverage audit + trial-expiry UX + a validated flag-flip. See the doc above.
- **✅ Blank-screen on tab switch — RESOLVED (2026-06-11).** Roast/Community/Profile intermittently
  rendered fully blank on navigation (Dashboard/Tools didn't). **Root cause:** the Tab.Navigator's
  `animation: 'shift'` (RN v7 bottom-tabs) mis-composited the react-native-screens scenes — heavier
  screens landed blank while their content sat off-screen, flashing during the reverse shift. **Fix:**
  `screenOptions={{ … animation: 'none' }}` in `AppNavigator`. Red herrings ruled out en route: the
  entrance animation, the focus DB fetch, a poisoned Fast-Refresh bundle. Kept from the hunt: all 15
  screens migrated off the legacy `useEntryAnimation` (RN `Animated` native-driver desync) → Reanimated
  `enterUp` (the right standard, not the bug); `TypingPlaceholder` now pauses off-tab; Roast's
  "Recent Scores" section removed. (If you ever want a tab transition back, try `animation: 'fade'`, not `'shift'`.)
- **🐞 Snapshot-merge corruption — diagnosed, deferred (plan A chosen).** A roast can write bad data
  into `financial_snapshots`. DB-verified (2026-06-11): (1) **debt can't be cleared** —
  `patchFromAnalysis` ([shared/financialSnapshot.ts](../shared/financialSnapshot.ts)) only writes
  `patch.debts` when `length > 0`, so a "paid off my debts" roast (`debts: []`) is dropped and the old
  `stated` debt persists forever; (2) **inferred income/savings overwrite brackets** — the analyze
  fabricates numbers to fill the schema even when the input never mentions them, and they enter the
  patch at `low` confidence, outranking the `estimated` bracket values (saw 7500→3500, 25000→250).
  Root: the analyze can't distinguish "user stated" from "I inferred to fill the schema." **Plan A
  (chosen) — design before code:** (a) honest per-field confidence from the analyze prompt (`stated`
  only when the user said it; `estimated` when schema-filling), (b) `patchFromAnalysis` writes
  `debts: []` on a confident clear + stops inferred values outranking brackets, (c) an explicit
  "debt cleared" signal. Touches the `analyze` edge function → **testing = paid calls (rule #1)**.
  Hidden under mocks (deterministic `SAMPLE_ANALYSIS`), so safe to defer past the demo.
- **🔒 Rate-limiting — revisit (security/privacy risk).** `api_rate_limits` (baseline ~L507) has
  **no RLS** — the schema comment assumes "accessed only via the SECURITY DEFINER `check_rate_limit`
  RPC," but without RLS or revoked grants the public-schema table is **directly queryable via PostgREST**
  by anon/authenticated. Worse, `deriveBucketKey` ([_shared/rateLimitLogic.ts](../supabase/functions/_shared/rateLimitLogic.ts))
  stores the **raw client IP in plaintext** (`bucket_key = `${endpoint}:${ip}`` from `x-forwarded-for`) —
  IP is PII under GDPR. So users' IPs sit in plaintext in an un-RLS'd, potentially-exposed table (the
  `cleanup_rate_limits` RPC prunes after 1 day). **Fix:** (1) `ENABLE ROW LEVEL SECURITY` on
  `api_rate_limits` (+ revoke anon/authenticated grants) so it's genuinely RPC-only; (2) **hash the IP**
  (`endpoint:sha256(ip + salt)`) — the limiter only needs a stable per-caller key, not the raw IP;
  (3) keep the short-TTL cleanup. Touchpoints: `supabase/functions/_shared/rateLimit*.ts` + the
  baseline's `api_rate_limits` table & `check_rate_limit` RPC.

## TODO — IA cleanup (do on Mac, alongside `onboarding-v2`)

From a nav-flow audit (2026-06-10), all decisions settled. Goal: tighten the IA before the Friday
demo recording. All low-risk except the rename sweep. No DB migrations in any of these.

- [ ] **Remove "Subscription Audit" from Settings.** It's a premium *tool* and already lives in
  Tools (`ToolsScreen` TOOLS array) — Settings should stay calm/utility (design-doctrine §0).
  Delete the row in `src/screens/SettingsScreen.tsx`. Keep the Tools entry.
- [ ] **Remove "Monthly Check-In" from Settings.** It's a core ritual already surfaced from
  Dashboard, Results, History, ActionPlan, and Notifications — listing it as a Settings row frames a
  primary feature as config. Delete the row in `src/screens/SettingsScreen.tsx`.
- [ ] **Relocate the `FinancialContext` entry point onto the Dashboard "Your Finances" card.**
  Today it's only reachable from a buried link inside the Roast composer (`HomeScreen`). The
  Dashboard card already shows Income / Debt / Savings — add a **chevron** on that card (or a
  separate "Update your numbers" CTA) → `navigation.navigate('FinancialContext')`. Then decide
  whether to drop the old `HomeScreen` link (lean: remove, to keep one obvious home).
  Files: `src/screens/DashboardScreen.tsx` (Your Finances card), `src/screens/HomeScreen.tsx`.
- [ ] **Strip check-ins out of Trend (`HistoryScreen`) → score-chart only.** Remove `CheckinTrend`,
  the Monthly Check-Ins list, and the "+ New check-in" button — check-ins already have their own
  `CheckinCard` on the Dashboard. While there, delete the now-dead `INLINE_LIMIT` const + the stale
  "shared by the History inline list" comment on `AnalysisRow` (the inline list was already removed).
  File: `src/screens/HistoryScreen.tsx`.
- [ ] **AllAnalyses: preview what the user actually said.** Surface the original input
  (`analyses.input_text`) as a one-line snippet in the row so roasts are recognizable. **No DB
  change** (column exists) — add `input_text` to `HISTORY_COLUMNS` (`src/services/tables.ts`) + the
  `AnalysisHistoryItem` type, then render it in `src/components/AnalysisRow.tsx`.
- [ ] **CreatorDashboard: remove the Settings duplicate.** It's launched from BOTH Profile and
  Settings behind `FEATURES.CREATOR_DASHBOARD`. Keep the single flag-gated entry in
  `ProfileScreen` (stays hidden while the flag is off); delete the `CREATOR_DASHBOARD` nav row in
  `src/screens/SettingsScreen.tsx`. Low priority — flag is off, won't appear in the demo. (See the
  CreatorDashboard note in CLAUDE.md "Parked / removed features.")
- [ ] **Rename files to match their role (sweep).** `DashboardScreen` *is* the Home tab while
  `HomeScreen` is actually the Roast composer — confusing. Rename `HomeScreen` → e.g.
  `RoastComposerScreen`; with check-ins gone, `HistoryScreen` → `TrendScreen` is now accurate too.
  Touches `AppNavigator` imports, the `RoastTab` wrapper, and the `Analyze` route + all references —
  mechanical but wide; do it as its own commit. (Treat as a pass, not a one-off.)

### Minor / optional (not blocking)

- **Trend bar-tap target.** Tapping a chart bar → that roast's Results is the intended interaction
  (kept) — just make sure the bar hit-area is ≥44pt, or add a tap-to-peek tooltip with a "view full
  →" affordance. Polish only.

## Known drift to verify (not yet acted on)

- **Onboarding debt step — RESOLVED (no drift; earlier note was a misread).** The current
  `src/screens/OnboardingScreen.tsx` (redesign/better-workflow) DOES collect debt: step 4 is
  "debt & savings" (`debtBracket` + `liquidSavingsBracket`, both required) and seeds a debt-aware
  `estimated` snapshot line. `CLAUDE.md` and `demo-checklist.md` are accurate. (The original "drift"
  flag came from reading the older `master` copy of the file — verify the working branch before
  flagging code-vs-doc conflicts.)

## Environment constraints (this machine)

- **Windows, no Mac** in this environment → can't build/run the iOS simulator or take screenshots.
  Type-check (`npx tsc --noEmit`) and `npm test` are the correctness signals here; device/visual
  verification happens in the Mac session.
- Paid-API discipline is `CLAUDE.md` rule #1 — never run `tools/eval/*`, `manual-test.ts`, or
  `test_anthropic.ts` without stating call count + cost and getting confirmation.

---

## Session log

_Newest first. One short entry per meaningful unit of work: what changed + any landmine learned._

### 2026-06-11 — schema-v2 cutover LIVE; auth/forms + device polish; blank-screen hunt; skills audit
- **schema-v2 cut over to Jason's own Supabase** (`qxybdaotduunnrjfjzbq`): `db reset` + 6 edge fns +
  Anthropic/Groq secrets; `redesign` fast-forwarded; coworker project deprecated. Backend verified live
  (real `analyze` + Google sign-in work). CLAUDE.md / memory / `.env` updated.
- **LoginScreen**: inline validation (per-field + form-level banner, no Alerts), separated fields,
  autofill, `automaticallyAdjustKeyboardInsets` keyboard fix. `DEV_FORCE_ONBOARDING` → off. **DOB
  Birthday timezone off-by-one fixed** (local Y-M-D parse/format).
- **Device targets off the SE** → **16e** (daily/small) + **17 Pro** (demo): run scripts, `audit-screen`,
  `demo-app`, `sim-capture`, CLAUDE.md.
- **Skills audit**: removed 3 web-oriented React skills (patterns/performance/testing), added
  `make-interfaces-feel-better` + a new `react-native-patterns` skill.
- **Two bugs logged to In-flight (above):** demo-critical **blank-screen on tab switch** (UNRESOLVED;
  `RoastComposerScreen` in a diagnostic state with `FOCUS_FETCH_DISABLED=true`), and **snapshot-merge
  corruption** (diagnosed, deferred, plan A).
- ⚠️ **Everything above is UNCOMMITTED** (approve-commits-first). `USE_AI_MOCKS` is `&& true` (QA default).

### 2026-06-10 — doc cleanup (removed 2 obsolete docs)
- Removed `docs/531_NEXT_STEPS.md` (dated May-27 iOS-readiness checklist; "next steps" now = this
  doc) and `docs/redesign/implementation-plan.md` ("no code written yet" but redesign is built;
  principles now in design-doctrine) — fixed its one dangling link in `research-brief.md`. KEPT
  `unified-financial-model.md` (accurate + cited by ~10 code/migration/README refs). `active-plan-design.md`
  NOT deleted — entangled (7 refs, 3 in live code); header updated to "implemented" with a
  lifecycle-superseded-by-schema-v2 pointer instead.

### 2026-06-10 — doc-consistency audit
- Codebase audit + doc-conflict pass. Caught + corrected a **self-inflicted** error: the
  "onboarding-debt drift" note was based on a stale `master` read — the current branch DOES collect
  debt, so CLAUDE.md/demo-checklist were right (note flipped to RESOLVED). Added a "docs to update at
  cutover" list to schema-v2 and a supersedes-pointer on roast-plan-rework (plan lifecycle). Lesson:
  verify the working branch before flagging code-vs-doc conflicts.

### 2026-06-10 — schema audit → schema-v2 consolidation plan (decisions finalized)
- Reconstructed the full schema from all 26 migrations + verified against code. Wrote
  `docs/schema-v2.md`: target lean schema, butterfly-effects map, and a **plan-lifecycle** design
  (fixed 90-day windows; status `active|completed|incomplete`; status-aware create; lazy window-end;
  completion→check-in/re-roast funnel = v1/post-demo). **All decisions D1–D8 settled.**
- Key findings: (1) RLS makes `community_posts` denormalization load-bearing — it CAN'T be slimmed
  to just `analysis_id` (analyses/profiles are owner-private; the feed is public). (2) `payments` is
  Stripe-legacy, only `gdpr.ts` refs it → drop. (3) `source_analysis_id` IS written + drives
  `has_action_plan` (don't drop). (4) rate-limiting IS wired into the 4 LLM edge fns. Renames:
  `subscriptions`→`tracked_subscriptions`, `user_subscriptions`→`plan_entitlements`,
  `active_plans`→`action_plans`. Post-demo refactor; hosted-DB reset needs coworker coord (rule #3).

### 2026-06-10 — IA open questions resolved; TODO finalized
- Settled both open questions: keep Trend + AllAnalyses (distinct), but strip check-ins out of Trend
  (Dashboard already has a `CheckinCard`) and add a "what the user said" preview to AllAnalyses via
  `analyses.input_text` (no DB change — add to `HISTORY_COLUMNS`). CreatorDashboard: dedup (single
  flag-gated Profile entry) + documented as half-implemented/deferred in CLAUDE.md Parked section.
- Note: history list user-input column is `input_text` (not `user_input`); not currently in
  `HISTORY_COLUMNS`, so the SELECT needs widening (code, not schema).

### 2026-06-10 — nav-flow audit → IA cleanup TODO queued
- Mapped the full screen/nav flow (auth gates → MainTabs hub → roast loop → pushed screens).
- Agreed IA fixes queued above (remove SubAudit + CheckIn from Settings; move FinancialContext entry
  to the Dashboard Your-Finances card; rename `HomeScreen`→`RoastComposerScreen` sweep). To be done
  on Mac alongside `onboarding-v2`. Trend-vs-AllAnalyses and CreatorDashboard-dedup left as open
  questions. Context: demo video of the new UI due Fri 2026-06-12.

### 2026-06-10 — workflow system + CLAUDE.md refresh (`better-workflow`)
- Pulled `redesign` to `519960c` (roast/plan rework, migration 00026 drops `analyses.action_plan`,
  new `RoastLoading`/`ToolSkeleton`, `ProcessingScreen` slimmed, analyze prompt reworked).
- Created this status doc as the read-first state index; added a "How to operate" loop + a Start-here
  pointer to `CLAUDE.md`; refreshed `CLAUDE.md` staleness (migrations → 00026, `active_plans` is the
  plan store, new components, `demo-app` skill).
- Landmine noted: `CLAUDE.md` drifts silently when feature branches land — hence the operating loop's
  "capture what you learn / append a Session Log entry" rule.
