# CLAUDE.md — Am I Broke?

Guidance for Claude Code working in this repository. Read this first.

> **Start here:** before doing any work, read [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) for
> *where the project is right now* (in-flight work, known drift, a Session Log). This file is *how
> things are built*; that file is *where we are*. Append a Session Log entry when you finish
> meaningful work.

## ⚠️ Critical rules (do not skip)

1. **Paid API cost confirmation.** Before running any script that calls the Anthropic API, the
   Groq API, or any other paid external API, first tell the human how many calls the script will
   make and the estimated cost. Wait for human confirmation before executing. **Never run paid
   scripts silently.** (Notable paid scripts: `tools/test_anthropic.ts`, `tools/eval/*`,
   `tools/manual-test.ts`.)
2. **AI mocks are ON in dev by default** (`src/config/ai.ts` → `USE_AI_MOCKS = __DEV__ && true`)
   so the frontend never burns API credits during QA. Mocks never ship to prod (`__DEV__` is
   false in release). Only flip mocks off deliberately, and mind rule #1 when you do.
3. **The Supabase project is self-owned now.** Project ref `qxybdaotduunnrjfjzbq` (Jason's own
   account) — schema-v2 was cut over to it (`db reset` + functions deploy). Full dashboard/CLI
   access, no coworker coordination. The old **coworker-owned** project (`zefhsplmgxefmpdqbbvv`,
   free tier) and its staging (`zgrfgzjnhkellqgqfque`) are **deprecated** — don't push to them.
4. **Branching:** active work happens on a feature branch (currently `redesign` / `better-workflow`);
   `master` is left stable. Branch before committing; don't commit/push unless asked.

## How to operate

Most pain in this repo comes from a cold start re-deriving state and from `CLAUDE.md` silently
drifting as feature branches land. The loop that prevents both:

1. **Read state first.** [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) indexes the live trackers
   (DECISIONS, design-doctrine, roast-plan-rework, demo-checklist, …) and carries a Session Log of
   what's in flight. Read it, then the area-specific doc, before changing that area.
2. **Reuse before building.** Grep for an existing component/hook/util/service first (see *Reuse &
   modularity rules*). The view layer stays thin; logic lives in `shared/` or a service.
3. **Verify what you can.** `npx tsc --noEmit` after every change (+ `npm test` when logic changed).
   Device/visual checks (SE screenshots) happen in the Mac session — say so rather than claiming a
   visual pass you couldn't run.
4. **Capture what you learn.** Hit a non-obvious landmine (deploy crash, remote-DB lag, signing
   quirk)? Add it to **Gotchas** below or **DECISIONS.md** *in the same change* — don't let the next
   session rediscover it. Append a one-line **Session Log** entry to PROJECT-STATUS.md when done.
5. **Commit hygiene.** Branch before committing; commit/push only when asked. Before offering a
   commit, run `git status --short` — if a file you changed isn't listed, it's gitignored or
   unchanged, so don't offer to commit it; just announce the path ("wrote it to `docs/…`").

## What this app is

"Am I Broke?" — a Gen Z personal-finance app (Expo + TypeScript, iOS-first, heading to the App
Store). The user describes their finances in plain English; the app returns an AI-powered roast,
a 0–100 financial health score, a spending breakdown, and (paid) a 90-day action plan, debt
payoff strategy, and scenario simulator. Handles **sensitive financial data** — treat security
and correctness as first-class.

**Monetization (as of 2026-06-03):** new users get **3 days of full free access** to everything.
After that it's a **hard paywall — there is NO permanent free tier**: using the app at all (roast,
score, breakdown, plan, debt tools, scenario simulator, deep-dive) requires a paid plan — **Action
Plan** (~$4.99/mo) or **Deep Dive** (~$9.99/mo, supersedes Action Plan). **No per-subscription free
trial** — the 3-day access is granted app-side on signup, NOT an Apple/RevenueCat introductory offer.
(The 3-day-access *enforcement* is **built but flag-gated OFF**, not missing: shared trial math
(`@shared/entitlement`, anchored on `user.created_at`, no migration), server `enforceEntitlement` in
`analyze`/`action-plan`, and client `canUseApp`/`hasAccess` gates all exist behind
`FEATURES.PAYWALL_ENFORCEMENT`. The remaining work is a coverage audit + the trial-expiry UX + a
**validated flag-flip** at the trial boundary — see [`docs/three-day-enforcement.md`](docs/three-day-enforcement.md).)

## Tech stack

- **App:** Expo SDK 55, React Native 0.83.6, React 19.2.0, TypeScript 5.9 (`strict`), New
  Architecture enabled. Metro bundler. Entry: `App.tsx` → `src/navigation/AppNavigator.tsx`.
- **Navigation:** React Navigation v7 — native-stack + bottom-tabs (+ legacy stack). Five tabs
  (custom `IOSTabBar`, sliding pill): **Home (`DashboardScreen`) · Tools · Roast · Community ·
  Profile**. **Roast** is a real dwell tab that renders the composer (`HomeScreen` with the `asTab`
  prop → in-screen header); the *same* `HomeScreen` is also pushed as the **"New Roast"** (`Analyze`)
  route for contextual entries (empty-hero CTA, etc.). A header **notification bell**
  (`NotificationBell`) replaces the old profile avatar and opens the computed **Notifications**
  center. **History** is a pushed stack screen.
- **State:** React Context (`AuthContext`) + hooks. No Redux/MobX. Local persistence via
  `@react-native-async-storage/async-storage`.
- **Backend:** Supabase — Postgres (SQL migrations + RLS) and **Deno edge functions**. LLM work
  (Anthropic Claude + Groq) lives server-side in edge functions, keyed by Supabase secrets.
- **Payments:** RevenueCat In-App Purchase (`react-native-purchases`). See `docs/REVENUECAT_SETUP.md`.
- **Auth:** Supabase Auth, Google OAuth via PKCE (`expo-auth-session`); deep-link scheme
  `amibroke://`.
- **Analytics:** PostHog (`posthog-react-native`), forced onto AsyncStorage.
- **Validation:** Zod (shared schemas). **Animation:** Reanimated v4. **Voice:** `expo-audio`.

## Repository structure

```
App.tsx                  App root: fonts, providers (Auth), RevenueCat init, navigation
src/
  navigation/            AppNavigator — all routes; RootStackParamList lives in src/types
  screens/               ~25 screens (Home, Results, Paywall, ActionPlan, DebtPayoff, etc.)
  components/             Reusable UI (NeonButton, GlassCard, ScoreRing, ScreenBackground,
                         RoastLoading, ToolSkeleton, …)
  context/AuthContext    Supabase client, session, OAuth (PKCE), RevenueCat identity sync
  hooks/                 useAnalysis, useSubscription, useVoiceInput, useShare, useDebtStrategy,
                         useNotifications, useRescore, useCheckinStatus…
  services/              Data/IO layer (see below)
  config/                ai.ts (mocks flag), features.ts (flags) — scoring lives in shared/scoring/
  theme/colors.ts        Design tokens: Colors, Typography, Spacing, Radius
  types/index.ts         App-wide types incl. RootStackParamList & PURCHASE_PRODUCTS
  __fixtures__/          Sample data for dev mocks
shared/                  Framework-agnostic financial logic shared by app + edge functions
  scoring/               CFPB / IRT scoring (cfpb_irt, bands, index)
  baselines/             National & per-state spending baselines
  schemas.ts             Zod schemas (FinalAnalysisSchema, etc.)
  calculations.ts        Pure financial math
supabase/
  migrations/            00001_baseline.sql — the squashed schema-v2 baseline (the old 00001–00026
                         were squashed into it at cutover; recover them from git history if needed)
  functions/             Deno edge functions (see below)
tools/                   Dev / test / ops scripts — NOT bundled into the app (`tsconfig` excludes it)
  eval/                  LLM eval harness: fixtures, runners, Zod assertions, cycle results in results/ (PAID — rule #1)
  manual-test.ts         Human-review CLI for the edge functions, `--input <name>` / `--save` (PAID — rule #1)
  test_anthropic.ts      Deprecated direct-Anthropic probe — use manual-test.ts (PAID — rule #1)
  deploy-all.sh          Deploy all 6 Supabase edge functions + run migrations
  run-sim.sh             Build+launch on the iOS sim (`npm run ios:sim`) — see the gotcha below
  sim-capture.sh         Drive the iOS simulator via idb to screenshot a long screen for UI review
  sim-record.sh          Record the booted sim to mp4 + extract frames (motion: splash/transitions/anims)
  lib/call-counter.ts    No-op shims (the old 40-call hard cap was removed); cost discipline is rule #1
```

### `src/services/` (the IO layer)
- `ai.ts` — all client→edge-function calls: `analyzeFinancialSituation`, `fetchOrGenerateActionPlan`,
  `revisePlanPatch`, `fetchOrGenerateCaptions`, `checkinReflection`. Body shape is always
  `freeText` + `userContext` + `tone` — never re-invoke `analyze`/`action-plan` elsewhere
- `financialSnapshot.ts` — read/write the unified per-user snapshot + `buildRescoreInput`
  (reconstructs analyze input from the snapshot for paywall-gated re-scoring)
- `analyses.ts` / `profile.ts` / `checkins.ts` / `community.ts` / `subscriptionAudit.ts` — CRUD per domain
- `subscriptions.ts` — tier/entitlement logic; reads RevenueCat (DB `user_subscriptions` as mirror)
- `purchases.ts` — RevenueCat SDK wrapper (configure/login/offerings/purchase/restore/manage). **Guarded:** no key → app runs as free tier
- `analytics.ts` — PostHog init + event helpers
- `gdpr.ts` / `creator.ts` / `notifications.ts` / `biometric.ts` / `activePlan.ts` / `tables.ts`

> The old 945-line `claudeApi.ts` kitchen sink was split — don't recreate it. There is no
> `moderation.ts` / `offlineCache.ts`.

### `supabase/functions/` (Deno) — six deployed/active
- `analyze` — generate the financial analysis (Claude tool-use, Groq fallback)
- `action-plan` — generate the 90-day plan (paid feature)
- `revise-plan` — patch/iterate an existing plan
- `generate-captions` — shareable caption generation
- `checkin-reflection` — short Haiku reflection for the monthly check-in (persisted to `check_ins.reflection`)
- `revenuecat-webhook` — sync IAP entitlement events → `user_subscriptions`
- `_shared/` — CORS (`cors.ts`), rate-limit, entitlement helpers

> The Stripe-era `create-payment-intent` / `confirm` / `verify` functions were ghosts and are
> gone — the app uses RevenueCat.

### Core systems (the unified model)
- **Financial snapshot** — one per-user `financial_snapshots` row (migration 00022) is the source
  of truth for *current* financial state, distinct from `analyses` (immutable roast history) and
  `check_ins` (progress time-series). Written by onboarding (estimated), each roast
  (confident-merge), and each check-in/manual edit; read by Dashboard, Debt Payoff, Action Plan,
  Results, and stale-state. The merge engine is `shared/financialSnapshot.ts` — a field updates
  only when incoming confidence ≥ stored (ladder `estimated < low < medium < high < stated`); a
  field the writer is silent on is kept; a mortgage is excluded from payoff debt + `debt_total`.
  See `docs/unified-financial-model.md`.
- **Action plan storage** — the active 90-day plan lives in **`active_plans`** (one per user, keyed
  by `source_analysis_id`); `analyses.action_plan` was **dropped** (migration 00026), so the active
  plan *is* the cache. `has_action_plan` in the history list derives from `active_plans`, not a column
  on `analyses`. Generating goes straight to an active plan (no preview/commit); a roast-input change
  **revises** it (keeps completed-step progress), never regenerates. See `docs/roast-plan-rework.md`.
- **Mandatory staged onboarding** (post-login, no skip) — 5 cheeky, personalized steps collect
  profile names + `ctx_*` income/savings/**debt** brackets (debt seeds a coarse `estimated` snapshot
  line via `DEBT_MID`). It ends with a **user-initiated starting-score reveal**: "Calculate my
  starting score" reuses the re-score path (`buildRescoreInput` → `analyzeFinances`, score-only,
  persisted via `mergeSnapshot`) and reveals it on the `ScoreRing`, then hands off to the first roast.
  The Dashboard shows that starting score (calm glow) for a 0-analysis user instead of the `?/100`
  hero. (Cheap-model routing for the onboarding score is a `TODO(cost)` — a `provider` param on
  analyze.)
- **Monthly check-in reframe** — a soft-monthly emotional ritual (mood/note → refresh per-debt
  figures → reward screen with delta + streak + AI reflection → handoff). `checkin-reflection`
  (Haiku) writes `check_ins.reflection` (00023). Streak on the home card; journey timeline in History.
- **Sticky preferences** — `profiles.preferred_tone` (00024) is the single source of truth for
  roast voice (HomeScreen selector + Settings → Roast Voice; read by analyze + check-in
  reflection). `profiles.debt_strategy` (00025) stickies avalanche/snowball on Debt Payoff.
- **Stale-state** — shared `StaleBadge`; the Dashboard shows a "score may be out of date" banner
  and re-scores from the snapshot via `buildRescoreInput` (no re-typing, paywall-gated; shared
  `useRescore` hook drives both the banner and the notifications center); a plan-stale "Update"
  badge does the same for the action plan.
- **Notifications center** — *computed*, no new table. `useNotifications` aggregates the nudges we
  already derive (score stale, plan stale via `shouldRevisePlan`, check-in due); `NotificationsScreen`
  lists them and each routes to where you act (score → re-score, plan → the plan, check-in → the
  check-in); the header `NotificationBell` shows an accent dot when any are pending. (Community
  reactions are a planned 4th signal — needs a "reactions on my posts" query.)
- **Edit Profile** (`EditProfileScreen`, Profile → Edit Profile) — first/last name + username for
  all; email + password only for email/password accounts (gated on `app_metadata.provider`), each
  re-authing with the current password first. OAuth users see a locked "Managed by {provider}"
  explainer instead.

## Conventions

- **⚠️ Design doctrine — read before any frontend work.** Creating, modifying, deleting, or
  rearranging UI follows [`docs/design-doctrine.md`](docs/design-doctrine.md): **disciplined-neon**
  brand (one `accent*`, semantics demoted), token-only styling (spacing/radius/type/color/motion),
  the motion system (`PressableScale`/`CountUp`/`entrances` + `useReducedMotion`), and
  **Heroicons-first** icons. The `/audit-screen` skill grades against it.
- **Path aliases:** `@/*` → `src/*`, `@shared/*` → `shared/*` (configured in `tsconfig.json`,
  `babel.config.js` module-resolver, and `metro.config.js`). Use them; avoid deep `../../`.
- **`shared/` is cross-runtime** — keep it framework-agnostic (no RN/Deno-specific imports) since
  both the app and edge functions consume it. Uses `.ts` import extensions
  (`allowImportingTsExtensions`).
- **Theme:** import tokens from `@/theme/colors` (`Colors`, `Typography`, `Spacing`, `Radius`);
  don't hardcode colors/spacing.
- **File references in chat:** use clickable markdown links, e.g. `[file.ts:42](src/file.ts#L42)`.
- **`tsconfig` excludes** `supabase/` and `tools/` (they're Deno/Node, not RN) — typecheck the
  app with `npx tsc --noEmit`.

## Reuse & modularity rules (don't re-invent what exists)

These are non-negotiable — they encode real mistakes found in audits. **Before writing a
component, hook, util, or data call, grep for an existing one.** Specifically:

1. **Reuse the existing primitives — never re-implement these:**
   - Score ring → `components/ScoreRing.tsx` (don't hand-roll SVG `Circle`/dashoffset ring math).
   - Subscription / entitlement gating → `useSubscription().hasAccess(cap)` / `.canUseApp`. Do **not**
     call `getSubscription` + `canAccess` + `getTrialStatus` directly in a screen.
   - Tappable rows/buttons → `components/motion/PressableScale` (press spring + haptic +
     reduce-motion), not bare `TouchableOpacity`.
   - Toggle → `components/Toggle.tsx`, never the RN `<Switch>`. Section headers → `SectionLabel`.
   - Count-up numbers / entrance animations → `components/motion/*`.
2. **Theme tokens only — no hardcoded values.** Colors/spacing/font-size/radius come from
   `@/theme/colors`. Use the **`accent*`** token family for the brand accent (not the legacy
   `primary*` aliases). Score-band labels/thresholds/colors come from `shared/scoring/bands.ts`
   (`getScoreBand`) — never re-encode the 40/60/80 cutoffs or band hex anywhere else.
3. **Motion via the system.** Use `components/motion/*` + `theme/motion.ts` tokens
   (`Durations`/`Easings`/`Springs`). No inline `ms`/`bezier` literals, no hand-rolled `Animated`.
4. **Data access only through services.** Screens/components must not touch Supabase tables
   directly (`supabase.from('…')`). Go through the service modules (`ai`, `analyses`, `profile`,
   `community`, `checkins`, `subscriptionAudit`). Every service uses the shared **`getSupabase()`**
   from `supabaseClient.ts` (test-injectable) — never `getSupabaseClient` directly, never
   `createClient`. All LLM/edge-function calls go through `services/ai.ts` (correct body shape:
   `freeText` + `userContext` + `tone`) — never re-invoke `analyze`/`action-plan` elsewhere.
5. **Modularize; keep the view layer thin.** One file = one concern (the 945-line `claudeApi.ts`
   kitchen sink was split for this reason — don't recreate it). Financial/business logic belongs in
   `shared/` or a service, not a screen. **Anything duplicated ≥ 3× (logic, JSX, or a literal)
   gets extracted** into a shared util/hook/component/constant.
6. **Leave it cleaner.** When you touch a file, delete its dead imports / unused `StyleSheet` keys /
   dead exports rather than adding alongside them. Centralize reused literals (route names, table
   names, brand strings, prices from `PURCHASE_PRODUCTS`) — one-off UI copy can stay inline.

## Testing

- Runner: **jest** (`jest-expo` preset). `npm test`. `npm run test:purchases` for the IAP unit test.
- Tests live in `src/**/__tests__/` and `shared/*.test.ts`. Mock native modules in unit tests
  (see `src/services/__tests__/purchases.test.ts` mocking `react-native-purchases`).
- Always run `npx tsc --noEmit` after changes — it's the fastest correctness signal here, and IAP
  / native flows can't be exercised in this environment without a device build.

## Common commands

```bash
npm run ios:se                                            # build+launch on the SE sim via Expo (resolves the sim UDID — see gotcha)
npm run ios:sim                                           # no-Expo fallback: xcodebuild → iphonesimulator SDK directly
npx expo start                                            # Metro (press shift+i to switch sims)
npx tsc --noEmit                                          # typecheck the app
npm test                                                  # jest
npx supabase db push                                      # apply migrations to the linked DB
npx supabase functions deploy <name>                      # deploy an edge function
```

## Environment

Client vars are `EXPO_PUBLIC_*` in `.env` (see `.env.example`): Supabase URL/anon key, PostHog
key/host, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, feature flags. **Server secrets** (Anthropic, Groq,
RevenueCat webhook auth, service role) are set via `supabase secrets set` and are never bundled
client-side.

## Gotchas

- **Edge-function prompts MUST be a static TS import, never a runtime `.txt` read.** The Supabase
  eszip deploy bundles only statically-imported modules — a `Deno.readTextFileSync(new URL('./prompts/system.txt', …))`
  reads a file that isn't in the bundle, so the worker **crashes on boot** (`WORKER_ERROR`, ~120ms,
  before the LLM). This bit us on revise-plan and again on analyze. Every prompt now lives in a
  `prompt.ts` (`export const SYSTEM_PROMPT = \`…\``) imported by the function's `index.ts`
  (analyze / action-plan / generate-captions / checkin-reflection), or inline in `index.ts`
  (revise-plan) — either way it's a statically-bundled module. **Never re-introduce a `.txt` prompt
  read.** Note a redeploy of an *unchanged* function with this pattern also crashes — the landmine
  is the deploy, not the edit.

- **`expo run:ios` works for the simulator — pass the sim's UDID, not its name.** Under Xcode 26 +
  Expo SDK 55, `expo run:ios --device "iPhone SE (3rd generation)"` (the *name*, with parens)
  mis-resolves the build destination to a device/generic target and fails with "No code signing
  certificates are available." Passing the **simulator UDID** instead (`expo run:ios --device <UDID>`)
  pins it to the simulator, where signing is local-only — so the build **ignores** the personal-team
  provisioning errors (Sign in with Apple / Push Notifications need the paid Developer Program, but
  only for *device* builds). `npm run ios:se` now resolves the SE sim's UDID automatically, so it
  works through Expo (Metro + dev client managed by Expo). `npm run ios:sim` (`tools/run-sim.sh`)
  remains the no-Expo fallback — it builds the *iphonesimulator* SDK directly via `xcodebuild`.

- **Simulator log noise** (CoreHaptics `hapticpatternlibrary.plist`, TextInputUI accumulator
  timeouts, `AddInstanceForFactory`) is benign and disappears on a real device — not app bugs.
- **RevenueCat IAP is testable for free in dev via the RevenueCat Test Store** (`test_…` key in
  `EXPO_PUBLIC_REVENUECAT_IOS_KEY`). In a dev build (`expo run:ios`, not Expo Go) the full Paywall →
  simulated purchase → entitlement → live paywall-subside flow works with no paid Apple account and
  no sandbox (verified 2026-06-02: bought Deep Dive, gating dropped live). `purchases.ts` refuses a
  `test_` key in production builds. The webhook→DB mirror (`user_subscriptions`) may not fire for
  Test Store purchases — that's fine, the app treats RevenueCat `customerInfo` as the source of truth
  and the DB is only a fallback/record. A paid Apple Developer membership is still needed for App
  Store Connect products, sandbox/TestFlight, and release. See `docs/REVENUECAT_SETUP.md`.

## Parked / removed features

- **Affiliate feature was unmounted (2026-05-31).** The "Affiliate Picks" screen, its
  `services/affiliate.ts` service, and the nav route were removed — too early-stage for affiliates,
  and the server-side `affiliate_clicks` insert had no backing table. The idea is kept for later;
  recover the implementation from git history if/when it's revived. The Terms of Service still
  carries a forward-looking affiliate-disclosure clause, which is fine. Don't re-add affiliate
  wiring without also creating the `affiliate_clicks` table (with RLS).
- **ScenarioSimulator** is an intentional "Coming Soon" stub (being rebuilt on the new scoring
  engine) — wired into nav but not implemented.
- **CreatorDashboard is half-implemented and deferred** (flag-gated off via
  `FEATURES.CREATOR_DASHBOARD`; the screen `goBack()`s on mount when the flag is off). It's a
  creator/influencer mode, not an end-user feature. Scope: (1) **Batch Roast** — loops the normal
  paid analyze pipeline (`batchRoast` → `analyzeFinancialSituation`) so a creator can roast many
  inputs at once (**real, but each input is a paid call — rule #1**); (2) **Referral code** —
  generates `BROKE-XXXX` + writes a `referrals` row (codes work, but **no payout system populates
  earnings**); (3) **Creator stats** derived from `community_posts` — "Views" is a reactions×10
  proxy and "Earnings" is effectively always $0 (vanity/aspirational). Treat as a parked
  monetization experiment: keep its single flag-gated entry in Profile, don't wire it into more
  surfaces, and don't surface "Views"/"Earnings" as if they're real without a backing payout/metrics
  system. (Dedup TODO: remove the duplicate Settings entry — see `docs/PROJECT-STATUS.md`.)

## Skills (in `.claude/skills/`)

Project-scoped skills curated for this stack. Invoke proactively when the **Use when** trigger fits —
don't wait to be asked.

| Skill | Use when |
|---|---|
| **audit-screen** | Grading a screen against the design doctrine — `/audit-screen <name>`. Screenshots the SE sim; checks readability/contrast/hierarchy/consistency, flags "too basic." Recommend-only; never implements until approved. **(Mac only — needs the simulator.)** |
| **react-patterns** | Writing/reviewing React hooks, state, or component structure (web-oriented; principles transfer to RN). |
| **react-performance** | A screen/list feels janky, re-renders too much, or you're optimizing render/scroll perf. |
| **react-testing** | Adding jest/RTL component or hook tests, or mocking network/native modules. |
| **postgres-patterns** | Designing schema, indexes, or RLS; tuning a Supabase/Postgres query. |
| **database-migrations** | Writing or reviewing a `supabase/migrations/*` change — safe/reversible schema edits. |
| **api-design** | Shaping an edge-function request/response contract (status codes, pagination, errors). |
| **error-handling** | Adding typed error handling / retries / user-facing error copy in TS or an edge function. |
| **security-scan** | Auditing `.claude/` config for misconfigurations (distinct from the built-in `/security-review`). |
| **git-workflow** | Branching/commit conventions — unsure how to branch or phrase a commit. |
| **cost-aware-llm-pipeline** | Touching LLM calls — model routing, budget tracking, prompt caching (pairs with rule #1). |
| **ios-icon-gen** | Generating Xcode app-icon imagesets for the App Store build. |
| **demo-app** | Recording a product walkthrough/demo of the app. |

Built-in skills also available (don't duplicate): `/deep-research`, `/security-review`,
`/code-review`, `/verify`, `/simplify`, `/run`.
