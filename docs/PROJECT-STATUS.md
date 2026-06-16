# Project Status — Am I Broke?

> **Read this first, every session.** It's the source of truth for *where we are right now*;
> `CLAUDE.md` is the source of truth for *how things are built*. When you finish meaningful work,
> append a one-line entry to the Session Log at the bottom. Keep this thin — link the living
> trackers below, don't duplicate them.

**Last updated:** 2026-06-11 · **Active branch:** `redesign`

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

- **Audit-sweep central fixes (`redesign`) — ✅ Waves A–F done + committed.** From
  [`redesign/post-onboarding-audit-2026-06-11.md`](redesign/post-onboarding-audit-2026-06-11.md); all
  screens **except** AppNavigator. A (dead code) · B (ad-hoc `` `$${n}` `` → `utils/format`) · C (bare
  `TouchableOpacity` → `PressableScale`) · D (Ionicons/MCI → Heroicons where an equivalent exists, else
  documented) · E (`TopScrim` → **solid** opaque mask, rolled out to the header-less tab screens) · F
  (Results P0: `useSubscription().hasAccess` + Reanimated `entering`) all landed. **Profile, Dashboard,
  and Community are fully audit-clean** and the open `[DISCUSS]` "Your Plan → App Store" item is resolved
  (Plans & Features + Manage Subscription split) — see Session log.
  - Deferred (heavier, not "central"): CC-5 thin-view extractions, CC-7 `.map`→`FlatList`, EditProfile's 5
    `supabase.*` calls → a service, CC-11 keyboard insets. Standardize the **danger** color
    (Sign-Out border is a raw `rgba(255,69,58,0.35)` — consider a `dangerContainer`-style token).
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
- **🩹 Paywall scroll — quick-fixed, proper fix pending (2026-06-11).** The `formSheet` presentation ate
  the inner `ScrollView` (RNScreens #2687/#3092 — scroll passthrough needs the `ScrollView` as the screen's
  *first child*, but `ScreenBackground` is first). **Quick-fix (done):** swapped the route to ShareScreen's
  `card` + `slide_from_bottom` (`AppNavigator.tsx`, `name="Paywall"`; verified scrollable, `tsc` clean);
  `sheetModal` parked with a `TODO`. **Proper fix TODO:** make the `ScrollView` the screen's first child
  (move `ScreenBackground` inside/behind it), re-apply the `sheetModal` sheet, and drop the now-vestigial
  grabber bar in `PaywallScreen`.

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

### 2026-06-16 — Claude Design briefs for the remaining app screens — UNCOMMITTED
- Wrote [`docs/redesign/screen-briefs-for-claude-design.md`](redesign/screen-briefs-for-claude-design.md):
  one brief each for the 9 still-to-design screens (**Roast Me composer, Results, Share, Community,
  History/Trend, 90-Day Plan, Check-In, Paywall, Profile**) so Claude Design can build them, paired with the
  existing [`mock-content-for-claude-design.md`](redesign/mock-content-for-claude-design.md) persona data.
- Followed the established brief conventions (auto-memory `claude-design-onboarding-prompt-style`):
  **no hardcoded colors except the 4 semantic score-band colors**, reuse established templates
  (score ring / list-group / segmented control / pill), describe only each screen's unique content +
  states, don't re-specify shared chrome. Added a recommended build order (templates cascade:
  Results→Share→Community→…) + a cross-screen consistency checklist. Derived structure from the live
  screens (`ResultsScreen`, `ActionPlanScreen`, `CommunityFeedScreen`, `MonthlyCheckInScreen`,
  `TrendScreen`, `PaywallScreen`, `ShareScreen`, `ProfileScreen`+`AccountSettings`) so the briefs
  match what the RN port will need. (`RoastComposerScreen` added in a follow-up — the Roast Me
  composer, entry to the core loop.) Doc-only; no code touched.

### 2026-06-16 (pm) — spending table (expenses backend) IMPLEMENTED — UNCOMMITTED
- Persistent named-spending breakdown (revises the earlier "no spending CRUD" call): new `spending`
  table (00003) is the source of truth, light CRUD, each roast merges its `mentionedSpending` in.
  Much simpler than debts — every item is `user_stated` → no confidence gate / tombstone / mirror /
  derived metric; **partial breakdown preserved (`sum != monthly_expenses`)** so no budgeting creep.
  `shared/spending.ts` `mergeSpending` (8/8) · `src/services/spending.ts` (CRUD + reconcile + mock) ·
  wired into `updateSnapshotFromAnalysis` · GDPR · `tables.ts`. **Also:** `monthlyExpenses` now seedable
  from onboarding (`OnboardingExact.expenses` → `patchFromOnboarding`, `stated`). `tsc` clean; `npm test`
  161 pass (+10), only the pre-existing `ai.test.ts` fail. Read sites unchanged (Results keeps the
  per-roast breakdown); editable spending surface is frontend (later). **Gated:** push 00003 with 00002.

### 2026-06-16 (pm) — debts table + reconcile (#3 + #5 backend) IMPLEMENTED — UNCOMMITTED
- Built the debt backend per [`docs/debts-table.md`](debts-table.md): new `debts` table (00002) is the
  source of truth (per-row source/confidence + soft-delete `deleted_at`); `financial_snapshots.debts`
  kept as a **denormalized mirror** the service syncs (chose this over "drop the JSONB" so read sites
  didn't change). Shared `reconcileDebts` (gate + tombstone suppress/lift + `debtsCleared` clear) +
  `debtTotalFromRows` + `withDebtsMirror` (36/36 tests). New `src/services/debts.ts` (CRUD/soft-delete +
  `reconcileFromAnalysis` + `applyCheckinBalances` + `getDebtContext` + mock store). Snapshot service
  rewired (roast reconciles debts; onboarding seeds a debt row; check-in delegates; rescore input +=
  debt context). `debtsCleared` added to `AIRawOutputSchema` + analyze prompt. GDPR export/delete.
  `npx tsc` clean; `npm test` +10 passing, only the pre-existing `ai.test.ts` saved-plan failure remains.
- **Gated / not done:** push migration `00002` to the live DB, redeploy `analyze` (prompt changed →
  must redeploy; rule about static-import deploy), and a **paid eval** of `debtsCleared` (rule #1). Dev
  runs on the mock store without any of these. **Deferred fast-follow:** `other`-line / `debtTotalStated`
  stated-total reconciliation (§3.1 / §8 Q5a).

### 2026-06-16 — redesign follow-ups #1/#2/#4 backend landed; #3 merge redesign discussed — UNCOMMITTED
- **#1 ($0 income)** + **#2 (exact debt/savings)**: `patchFromOnboarding`'s second arg is now an
  `OnboardingExact` `{ income?, savings?, debt? }`; each field accepts a finite `>= 0` exact (incl. an
  explicit `0`) → `stated`, else the bracket midpoint stays `estimated`. `seedSnapshotFromOnboarding`
  + both callers (`OnboardingScreen`, `FinancialContextScreen`) updated. Dormant/zero-regression:
  `parseIncome` still drops `"0"`→`null`, so current callers hit the bracket path unchanged; the
  **frontend wiring** (numpad "None"→0, pass exact savings/debt) is a later session.
- **#4 (band rename "Financially Fragile" → "Cooked")**: all 7 live spots renamed (bands.ts source +
  union type, ScoreRing, OnboardingScreen, AnalyzingHero, bands.test, action-plan prompt, doc).
  `scoreLabel` derives from `getScoreBand().label` so the single source edit propagates to LLM output.
- Verified: `financialSnapshot.test.ts` 26/26 (incl. new #1/#2 cases); `bands.test.ts` asserts "Cooked".
  Pre-existing-only failures remain (4 native-module tsc errors; `ai.test.ts` saved-plan — both confirmed
  present on a clean stash, not from this work; `node:test` shared suites aren't jest-runnable).
- **#3 (debt-payoff merge) + #5 (manual debt CRUD) — root-caused + designed; build staged.** Core bug =
  the empty-debts-array is overloaded: `patchFromAnalysis` drops `debts: []` as "no signal" (so "I paid
  off all my debts" never zeroes the stale line). **Decision:** move debts to a dedicated **`debts`
  table** mirroring `tracked_subscriptions` (per-row RLS + CRUD) **+ per-row source/confidence** (debts,
  unlike subs, are LLM-written → need provenance + a confidence-gated reconcile). Fix = storage-agnostic
  `debtsCleared` analyze signal (Part A, launch-blocker; **touches analyze prompt → rule #1 eval**) +
  per-row reconcile (Part B). Full plan written → [`docs/debts-table.md`](debts-table.md); **implement
  next dedicated backend session.**
- **#6 logged (editable snapshot scalars: income/expenses/savings tap-to-edit; spending stays a light,
  capped infographic — no full CRUD).** Companion to #5 but lighter: the scalar merge-stickiness **already
  works** in the engine (`'manual'` source + `stated` confidence, gated so an inferred roast can't
  clobber it) — backend = three thin service setters, no `shared/` merge change, independent of the
  debts table. Bulk is frontend tap-to-edit. → redesign doc §6.

### 2026-06-15 — onboarding redesign (Claude Design) → 3 backend follow-ups logged
- Onboarding redesign is running as screen-by-screen Claude Design briefs into one `Onboarding.html`
  flow shell (story Act 1 + 6 build steps + loading + reveal). Brief conventions live in auto-memory.
- Logged 3 backend follow-ups the redesign implies → [`docs/redesign/claude-redesign-6-15-2026.md`](redesign/claude-redesign-6-15-2026.md):
  (1) capture $0/"None" income (`patchFromOnboarding` `>0` guard) — **`analyze/prompt.ts` + CFPB scoring verified safe, no change**;
  (2) allow exact debt/savings via the new numpad screens, not just brackets (`patchFromOnboarding` has an exact path for income only today);
  (3) 🔴 **confidence-merge mishandles a debt payoff** — "I paid off all my debts" didn't land on a ~$10k/$50k/$2k snapshot (mocks OFF); revisit the confidence ladder + the silent-vs-explicit-zero distinction **before launch**. (1)+(2) user-owned; (3) pre-launch.

### 2026-06-12 — Settings dedup → Profile/Settings merged into one account hub — COMMITTED
Two passes, both on `redesign`, `tsc` clean. The user drives the sim/Metro now (I don't reload).
- **Settings dedup (first).** Removed the redundant "Subscription" row (whole Account section — plan
  mgmt lives in Profile) and the "Sign Out" row (duplicated Profile's button + miscategorized under
  Danger Zone). Fixed a real bug: the Clear-History spinner never fired — the loading key was derived
  from the row label (`'clear'` was never set); replaced with an explicit `loadingKey`.
- **Full merge (Cash App model).** Profile looked empty after the stats row was dropped, so we
  **eliminated the standalone Settings screen** and inlined everything into Profile. Extracted a new
  `components/AccountSettings.tsx` (owns all toggle/biometric/notification/GDPR state so the Profile
  view stays thin); it renders Account · Notifications · Security · App · Support · Danger Zone →
  Sign Out → version. Profile is now just Hero → `<AccountSettings/>`. Deleted `SettingsScreen.tsx`,
  removed the `Settings` route from `AppNavigator` + `RootStackParamList` (only Profile's Quick-Access
  row referenced it). Icon tweaks: Plans & Features = Sparkles, Roast Voice = ChatBubble, Clear History
  = ArchiveBoxXMark, Delete Account = Trash. Sign Out kept pure-text (it's a button, not a row).

### 2026-06-11 — audit sweep complete (Waves B–F) + Profile hero glow-up + Community polish — COMMITTED
Finished the post-onboarding audit sweep and the per-screen passes for **Profile, Dashboard, and
Community** (now considered done). On `redesign`, `tsc` clean, committed. Sim is the other session's
running Metro — edits hot-reload; I screenshot, don't rebuild.
- **Sweep Waves B–F ✅** — B (`utils/format`), C (`PressableScale`), E (solid `TopScrim` rolled out to
  all header-less tab screens), F (Results `useSubscription().hasAccess` + Reanimated `entering`), then
  D (Ionicons/MCI → Heroicons; kept + documented `snow-outline`/`ellipse-outline` and the Results
  financial-metric rows where no Heroicon equivalent exists).
- **Profile hero glow-up.** Merged the avatar card + stats into one continuous hero with a soft accent
  glow (diagonal `LinearGradient` wash, not a clipped circle); moved **Edit Profile** onto the hero
  (magenta pencil on an `accentContainer` chip, dropping the Quick-Access row); removed the redundant
  current-score card (lives only on Dashboard) and the duplicate tier pill; avatar success `Alert` → Toast.
- **Resolved the audit's open `[DISCUSS]`** "Your Plan → App Store manage": split into **Plans & Features**
  (in-app, all users → Paywall, which already marks the owned tier "Current Plan") + **Manage Subscription**
  (premium only, explicit `↗` external affordance → StoreKit `manageSubscriptions()`).
- **Profile icon pass + token purity** — bare white Heroicons, `isSubscriptionPremium` → hook `premium`,
  `#fff` → `Colors.onAccent`, glow → `Colors.accentContainer`. CheckinCard bell/calendar → Fire/FaceSmile/Clock.
- **Roast tab** — stripped the check-in + paywall-teaser cards (composer is roast-only; enforcement gate kept).
- **Community** — stronger subtitle ("Anonymous roasts and scores from people figuring it out too."),
  `Durations.fast` motion tokens, `TAB_BAR_HEIGHT` bottom padding, `numberOfLines` clamps. Share FAB
  placement confirmed good (bottom-right primary create action).
- **Landmine:** removing the Profile score card cascaded orphaned imports/state/styles — `tsc --noUnusedLocals`
  is the fastest way to surface them.

### 2026-06-11 — audit-sweep central fixes (Wave A) + Profile name bug — UNCOMMITTED
Acting on the post-onboarding audit's cross-cutting findings, all screens **except** Dashboard (the
parallel session owns it) and AppNavigator. On `redesign`, `tsc` clean, **not committed**. Sim is the
other session's running Metro (`/tmp/metro.log`) — edits hot-reload; I screenshot, don't rebuild.
- **Wave A — dead code (CC-8) ✅.** Removed the audit's named dead imports/exports/computations (Trend
  `LinearGradient`/`Svg`/`getScoreBand`/`scoreGradient`/`GlassCard`/`Radius` + `deltaById`/`periodItems`;
  Profile `TextInput`; Settings `LinearGradient`; FinancialContextForm `CTX_COLUMNS`; RoastComposer 5 dead
  `score*` style keys) **plus** a one-off `tsc --noUnusedLocals` probe that caught **17 more** (CheckinTrend,
  Skeleton, StateSelect, Toast, CommunityFeed, CreatorDashboard, DebtPayoff incl. orphaned nav imports,
  PrivacyPolicy, Results `ScrollView`, TermsOfService, SubscriptionAudit `keepCount`). Skipped off-limits
  files (AppNavigator/Dashboard/auth/AuthContext/tests).
- **Profile name bug ✅.** The avatar hero only showed `@username`; `display_name` was fetched-but-never-
  rendered (obsolete — profiles have no `display_name`). Now renders the real **first + last name**
  (capitalized) with `@username` demoted to a secondary handle; dropped the dead `displayName` state.
  Sim-verified ("Jason L").
- **Also this session:** loading-animation pass committed (`a246e42` — JourneyLoading plan loader +
  score-ring roast loader); dev mocks flipped back **on** (`USE_AI_MOCKS = __DEV__ && true`).

### 2026-06-11 — Dashboard (Home) redesign pass — implemented, UNCOMMITTED
Acting on the audit's Dashboard deep-dive. On `redesign`, `tsc` clean + sim-verified, **NOT committed**
(a parallel Claude session is active). New components: `TopScrim`, `Sparkline`, `PlanCtaCard`.
- **Top scrim** (`components/TopScrim.tsx`) — a gradient mask rendered above the ScrollView; fixes the
  "transparent corners / content sliding under the status bar" on scroll. Applied to all 3 Dashboard
  return paths; reusable for Community/Results/History to kill the issue app-wide.
- **Extractions/cleanup**: hand-rolled SVG sparkline → `components/Sparkline.tsx`; `fmtMoney` →
  `formatCompactCurrency` in `utils/format.ts`; stale-banner `↻` glyph → `ArrowPathIcon`.
- **Layout/tokens**: check-in card moved directly under the hero (it PERSISTS + swaps copy — the old
  "renders only when due" comment was wrong); its chevron `accent`→`textSecondary`. Debt figure no longer
  `danger`-colored (semantic misuse) → `textPrimary`. Finance **labels** enlarged (caption2→footnote);
  values left at title3.
- **Contextual plan CTA** (`components/PlanCtaCard.tsx`) — replaces the generic "plan & tools" nav-dup and
  moves **above** Trend/Roasts. 3 states keyed on `hasAccess('action_plan')` + `plan`: live progress
  (Day/%/steps) · build prompt · unlock (reuses `PremiumCard`, now with optional title/body overrides →
  Paywall). Prompt/unlock copy leads with the most salient snapshot signal (overspending → debt →
  thin-savings → glow-up), qualitative + supportive-coach. `PremiumCard` still used by Roast/Tools.
- **Navbar** (`IOSTabBar` in AppNavigator): selected pill → wider, shorter rounded-rectangle (capsule
  margins 36→24, `PILL_GAP` 8→4, `PILL_H` 52→46); capsule raised ~10pt (clamp 16→26, `TAB_BAR_HEIGHT`
  76→86) so it floats clear of the gesture area.
- **Tier**: the temp `DEV_FORCE_DEEP_DIVE → 'free'` Paywall-viewing override has been **reverted** to `'deep_dive'`.

### 2026-06-11 — post-onboarding audit (~20 screens) + Paywall scroll fix
- **Full post-onboarding visual + code audit** on the 16e — see
  [`redesign/post-onboarding-audit-2026-06-11.md`](redesign/post-onboarding-audit-2026-06-11.md)
  (recommend-only). Cross-cutting: scroll/safe-area "transparent corners" (confirmed on every scroll
  screen), ~30 bare `TouchableOpacity`→`PressableScale`, Ionicons→Heroicons, ad-hoc `$`→`format.ts`;
  **Results** calls `getSubscription`/`canAccess`/`getTrialStatus` directly (P0) and rests an
  `opacity:0` ScrollView (the documented blank-screen risk); **EditProfile** has 5 direct `supabase.*` calls.
- **✅ Paywall scroll fixed** (details in In-flight): `formSheet`→`card`+`slide_from_bottom`. `tsc` clean.
- **Roast composer:** flagged to remove the check-in card + the bottom "Fix your finances" paywall card
  (recommendations, not yet done). **Profile→"Your Plan"** opens the StoreKit manage sheet on a premium
  tier (shows "Cannot Connect" in-sim) — **DISCUSS**.
- ⚠️ **Temp edit active:** `subscriptions.ts` `DEV_FORCE_DEEP_DIVE`→`'free'` (to view the paywall) — revert
  to `'deep_dive'`. Uncommitted: `AppNavigator.tsx` (keep), `subscriptions.ts` (revert), the audit doc.

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
