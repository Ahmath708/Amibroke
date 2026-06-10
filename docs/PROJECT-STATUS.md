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
