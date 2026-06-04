# CLAUDE.md — Am I Broke?

Guidance for Claude Code working in this repository. Read this first.

## ⚠️ Critical rules (do not skip)

1. **Paid API cost confirmation.** Before running any script that calls the Anthropic API, the
   Groq API, or any other paid external API, first tell the human how many calls the script will
   make and the estimated cost. Wait for human confirmation before executing. **Never run paid
   scripts silently.** (Notable paid scripts: `tools/test_anthropic.ts`, `tools/eval/*`,
   `tools/manual-test.ts`.)
2. **AI mocks are ON in dev by default** (`src/config/ai.ts` → `USE_AI_MOCKS = __DEV__ && true`)
   so the frontend never burns API credits during QA. Mocks never ship to prod (`__DEV__` is
   false in release). Only flip mocks off deliberately, and mind rule #1 when you do.
3. **The Supabase project is coworker-owned (free tier).** Project ref `zefhsplmgxefmpdqbbvv`.
   `supabase db push` works from the CLI, but the hosted DB can lag the migration files — a
   PGRST204 "column not found" at runtime means a migration wasn't applied remotely. Editing
   Auth/dashboard settings needs an elevated org role the dev may not have. A separate
   **AmIBroke-staging** project (`zgrfgzjnhkellqgqfque`) exists.
4. **Branching:** active work happens on the `dev` branch; `master` is left stable. Branch before
   committing; don't commit/push unless asked.

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
(The 3-day-access *enforcement* — granting access + hard-gating after expiry — is NOT yet implemented;
the paywall UI/copy + docs reflect the model, the entitlement logic is the remaining work.)

## Tech stack

- **App:** Expo SDK 55, React Native 0.83.6, React 19.2.0, TypeScript 5.9 (`strict`), New
  Architecture enabled. Metro bundler. Entry: `App.tsx` → `src/navigation/AppNavigator.tsx`.
- **Navigation:** React Navigation v7 — native-stack + bottom-tabs (+ legacy stack). Tabs are
  **Home (`DashboardScreen`) · Tools · Community**; the analyze input is `HomeScreen`, pushed as
  the **"New Roast"** (`Analyze`) route; **Profile** and **History** are pushed stack screens.
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
  components/             Reusable UI (NeonButton, GlassCard, ScoreRing, ScreenBackground, …)
  context/AuthContext    Supabase client, session, OAuth (PKCE), RevenueCat identity sync
  hooks/                 useAnalysis, useSubscription, useVoiceInput, useShare, useDebtStrategy…
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
  migrations/            00001–00014, applied via `supabase db push`
  functions/             Deno edge functions (see below)
tools/                   Dev / test / ops scripts — NOT bundled into the app (`tsconfig` excludes it)
  eval/                  LLM eval harness: fixtures, runners, Zod assertions, cycle results in results/ (PAID — rule #1)
  manual-test.ts         Human-review CLI for the edge functions, `--input <name>` / `--save` (PAID — rule #1)
  test_anthropic.ts      Deprecated direct-Anthropic probe — use manual-test.ts (PAID — rule #1)
  deploy-all.sh          Deploy all 6 Supabase edge functions + run migrations
  run-sim.sh             Build+launch on the iOS sim (`npm run ios:sim`) — see the gotcha below
  sim-capture.sh         Drive the iOS simulator via idb to screenshot a long screen for UI review
  sim-record.sh          Record the booted sim to mp4 + extract frames (motion: splash/transitions/anims)
  lib/call-counter.ts    Shared 40-call/session hard cap used by the paid scripts
```

### `src/services/` (the IO layer)
- `claudeApi.ts` — main client→edge-function calls (analyze, action plan, captions) + analyses CRUD
- `subscriptions.ts` — tier/entitlement logic; reads RevenueCat (DB `user_subscriptions` as mirror)
- `purchases.ts` — RevenueCat SDK wrapper (configure/login/offerings/purchase/restore/manage). **Guarded:** no key → app runs as free tier
- `analytics.ts` — PostHog init + event helpers
- `moderation.ts` / `gdpr.ts` / `creator.ts` / `offlineCache.ts`

### `supabase/functions/` (Deno)
- `analyze` — generate the financial analysis (Claude/Groq)
- `action-plan` — generate the 90-day plan (paid feature)
- `generate-captions` — shareable caption generation
- `revenuecat-webhook` — sync IAP entitlement events → `user_subscriptions`
- `_shared/` — CORS, rate-limit, JSON helpers (`cors.ts`)

## Conventions

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
npm run ios:sim                                           # build+launch on the SE sim (USE THIS — see gotcha)
npx expo run:ios --device "iPhone SE (3rd generation)"   # ⚠️ broken under Xcode 26 + SDK 55 (signing error)
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

- **Build with `npm run ios:sim`, not `expo run:ios`.** Under Xcode 26 + Expo SDK 55, `expo run:ios`
  (and the `ios`/`ios:se` scripts) mis-resolve the destination to a device/Mac target and fail with
  "No code signing certificates are available." `tools/run-sim.sh` builds the *iphonesimulator* SDK
  directly (no signing) and installs/launches via `simctl`, sidestepping Expo's device picker.

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

## Skills (in `.claude/skills/`)

Project-scoped skills curated for this stack — invoke when relevant:
- **audit-screen** — design-audit a single screen against the app concept + theme
  (`/audit-screen <name>`): screenshots the SE sim, checks readability/contrast/hierarchy/
  consistency, judges if it's too basic. Recommend-only; never implements until approved.
- **react-patterns**, **react-performance** — React hooks/state/perf (web-oriented; principles
  transfer to React Native)
- **react-testing** — jest/RTL component + hook testing, network mocking
- **postgres-patterns**, **database-migrations** — Postgres schema/indexing/RLS and safe migrations
- **api-design**, **error-handling** — REST patterns and typed TS error handling for edge functions
- **security-scan** — audit `.claude/` config for misconfigurations (distinct from the built-in
  `/security-review` code review)
- **git-workflow** — branching/commit conventions
- **cost-aware-llm-pipeline** — model routing, budget tracking, prompt caching (fits rule #1)
- **ios-icon-gen** — generate Xcode app-icon imagesets for the App Store build

Built-in skills also available (don't duplicate): `/deep-research`, `/security-review`,
`/code-review`, `/verify`, `/simplify`, `/run`.
