# 💸 Am I Broke?

A Gen Z personal-finance app built with **Expo + TypeScript** (iOS-first). Describe your finances
in plain English and get an AI-powered roast, a 0–100 financial health score, a spending
breakdown, and — on a paid plan — a 90-day action plan, debt-payoff strategy, and scenario
simulator. Handles **sensitive financial data**; security and correctness are first-class.

> New to this repo? Read **[CLAUDE.md](CLAUDE.md)** first — it's the curated working guide
> (critical rules, conventions, reuse rules, gotchas).

---

## What the app does

The product is built around one idea: **the user has a single, live "current financial state"**,
and every feature reads from it.

- **Roast + score** — paste a free-text description of your money situation, pick a roast voice,
  and get back a roast, a CFPB-methodology health score (0–100), deterministic metrics (savings
  rate, DTI, emergency-fund months), and a spending breakdown.
- **Mandatory onboarding** — a short staged flow after first login seeds your profile (names) and
  income/savings/debt brackets so advice is accurate from day one.
- **Financial snapshot** — onboarding, each roast, and each monthly check-in write into one
  per-user snapshot via a confident-merge engine. The Dashboard, Debt Payoff, Action Plan, and
  Results all read from it.
- **Monthly check-in** — a soft-monthly emotional ritual (mood/note → refresh your debts &
  figures → a reward screen with your delta, streak, and a short AI reflection). The journey
  timeline lives in History.
- **Stale-state nudges** — when your snapshot drifts from your last score, the Dashboard shows a
  "score may be out of date" banner and can re-score from the snapshot (no re-typing).

---

## Tech stack

- **App:** Expo SDK 55, React Native 0.83.6, React 19.2.0, TypeScript 5.9 (`strict`), New
  Architecture enabled. Metro bundler. Entry: `App.tsx` → `src/navigation/AppNavigator.tsx`.
- **Navigation:** React Navigation v7 — native-stack + bottom-tabs. Five tabs (custom `IOSTabBar`
  with a sliding pill): **Home (`DashboardScreen`) · Tools · Roast · Community · Profile**. **Roast**
  is a real tab that renders the composer (`HomeScreen`); the same screen is also pushed as the
  **"New Roast"** (`Analyze`) route for contextual entries. A header **notification bell** opens the
  computed **Notifications** center. **History** is a pushed stack screen.
- **State:** React Context (`AuthContext`) + hooks. Local persistence via AsyncStorage.
- **Backend:** Supabase — Postgres (SQL migrations + RLS) and **Deno edge functions**. All LLM
  work (Anthropic Claude + Groq fallback) runs server-side in edge functions, keyed by Supabase
  secrets.
- **Payments:** RevenueCat In-App Purchase (`react-native-purchases`) — Apple IAP, not Stripe.
- **Auth:** Supabase Auth; Apple + Google OAuth via PKCE (`expo-auth-session`); deep-link scheme
  `amibroke://`.
- **Analytics:** PostHog. **Validation:** Zod. **Animation:** Reanimated v4. **Voice:** `expo-audio`.

---

## Quick start

### 1. Install
```bash
npm install
```

### 2. Environment
Copy `.env.example` → `.env` and fill in the `EXPO_PUBLIC_*` client vars (Supabase URL/anon key,
PostHog, RevenueCat). See **[Environment](#environment)** below.
```bash
cp .env.example .env
```

### 3. Run (iOS simulator)
```bash
npm run ios:sim      # builds the iphonesimulator SDK + launches (USE THIS — see gotcha below)
```
> ⚠️ Use `npm run ios:sim` (which runs `tools/run-sim.sh`), **not** `expo run:ios`. Under Xcode 26
> + Expo SDK 55, `expo run:ios` mis-resolves the destination to a device/Mac target and fails with
> a code-signing error. `run-sim.sh` builds the simulator SDK directly and installs/launches via
> `simctl`, sidestepping the device picker.

Metro only (to switch sims with `shift+i`):
```bash
npx expo start
```

### 4. Backend (Supabase)
See **[Deploying the backend](#deploying-the-backend)**.

> **AI mocks are ON in dev by default** (`src/config/ai.ts` → `USE_AI_MOCKS = __DEV__ && true`) so
> the frontend never burns API credits during QA. Mocks never ship to prod (`__DEV__` is false in
> release builds). Flip them off deliberately, and read **CLAUDE.md → Critical rules** first.

---

## Repository structure

```
App.tsx                  Root: fonts, providers (Auth), RevenueCat init, navigation
src/
  navigation/            AppNavigator — all routes; RootStackParamList in src/types
  screens/               ~29 screens (Dashboard, Home, Results, Paywall, ActionPlan, DebtPayoff,
                         MonthlyCheckIn, Onboarding, Tools, Community, History, Notifications,
                         EditProfile, …)
  components/            Reusable UI (NeonButton, GlassCard, ScoreRing, ScreenBackground,
                         StaleBadge, Fab, motion/*, …)
  context/AuthContext    Supabase client, session, OAuth (PKCE), RevenueCat identity sync
  hooks/                 useAnalysis, useSubscription, useCheckinStatus, useRequireEntitlement,
                         useVoiceInput, useShare, …
  services/              Data/IO layer (see below)
  config/                ai.ts (mocks flag), features.ts (flags)
  theme/colors.ts        Design tokens: Colors, Typography, Spacing, Radius
  types/index.ts         App-wide types incl. RootStackParamList & PURCHASE_PRODUCTS
  __fixtures__/          Sample data for dev mocks
shared/                  Framework-agnostic logic shared by app + edge functions
  financialSnapshot.ts   The unified snapshot + confident-merge engine
  entitlement.ts         3-day-access / subscription trial-window math (one source for app + edge)
  scoring/               CFPB / IRT scoring (cfpb_irt, bands, index)
  baselines/             National & per-state spending baselines
  schemas.ts             Zod schemas (FinalAnalysisSchema, etc.)
  calculations.ts        Pure financial math
  checkinCadence.ts / planRevision.ts
supabase/
  migrations/            00001–00025, applied via `supabase db push`
  functions/             Deno edge functions (see below)
tools/                   Dev / test / ops scripts — NOT bundled into the app
docs/                    Project docs (see docs/ section)
```

### `src/services/` (the IO layer)
Screens never touch Supabase tables directly — they go through services, which all share the
single `getSupabase()` client from `supabaseClient.ts`.
- `ai.ts` — all client→edge-function calls: `analyzeFinancialSituation`, `fetchOrGenerateActionPlan`,
  `fetchOrGenerateCaptions`, `revisePlanPatch`, `checkinReflection`
- `financialSnapshot.ts` — read/write the per-user snapshot + `buildRescoreInput` (reconstructs
  analyze input from the snapshot for paywall-gated re-scoring)
- `analyses.ts` / `profile.ts` / `checkins.ts` / `community.ts` / `subscriptionAudit.ts`
- `subscriptions.ts` — tier/entitlement logic (reads RevenueCat; DB `user_subscriptions` is a mirror)
- `purchases.ts` — RevenueCat SDK wrapper. Guarded: no key → app runs as free tier
- `analytics.ts` / `gdpr.ts` / `creator.ts` / `notifications.ts` / `biometric.ts`

### `supabase/functions/` (Deno edge functions)
Six functions are deployed/active:
- `analyze` — generate the financial analysis (Claude tool-use, Groq fallback)
- `action-plan` — generate the 90-day plan (paid feature)
- `revise-plan` — patch/iterate an existing plan
- `generate-captions` — shareable caption generation
- `checkin-reflection` — short Haiku reflection for the monthly check-in (persisted to
  `check_ins.reflection`)
- `revenuecat-webhook` — sync IAP entitlement events → `user_subscriptions`
- `_shared/` — CORS, rate-limit, entitlement helpers

> The Stripe-era `create-payment-intent` / `confirm` / `verify` functions were ghosts and are
> gone — the app uses RevenueCat.

---

## Core systems

### Unified financial snapshot
A single per-user `financial_snapshots` row (migration **00022**) is the source of truth for the
user's **current** financial state — distinct from `analyses` (immutable roast history) and
`check_ins` (the progress time-series). It stores flat derived-metric columns (what features
read) + a `provenance` JSONB (per-field `{value, source, confidence, updatedAt}`) + a `debts`
JSONB.

It's written by **onboarding** (estimated), each **roast** (confident-merge), and each
**check-in** / manual edit, and read by the Dashboard, Debt Payoff, Action Plan, Results, and the
stale-state system. The merge engine lives in `shared/financialSnapshot.ts`: a field only updates
when the incoming confidence is ≥ the stored one (confidence ladder
`estimated < low < medium < high < stated`), and a field the writer is silent on is kept. A
mortgage is excluded from payoff debt + `debt_total` (it's not "dig-out" debt). See
**[docs/unified-financial-model.md](docs/unified-financial-model.md)**.

### Mandatory staged onboarding
After first login, a short staged flow (names → about you → situation → income → debt & savings)
writes `profiles` (names + `ctx_*` brackets + `onboarded`) and seeds the snapshot. Income can be
given as an exact monthly figure (optional) or a bracket. No skip.

### Monthly check-in (the reframe)
A soft-monthly emotional ritual, pulse-led: mood/note → refresh per-debt figures → a reward
screen (delta + streak + AI reflection) → handoff. The `checkin-reflection` edge function (Haiku)
writes a short reflection persisted to `check_ins.reflection` (migration **00023**). Streak shows
on the home card; the journey timeline lives in History.

### Sticky roast voice + debt strategy
`profiles.preferred_tone` (migration **00024**) is the single source of truth for tone — set from
the HomeScreen selector (sticky) and Settings → Roast Voice; read by `analyze` and the check-in
reflection. `profiles.debt_strategy` (migration **00025**) stickies the avalanche/snowball choice
on the Debt Payoff screen, which also shows paydown progress derived from check-in history.

### Stale-state system
A shared `StaleBadge` component. When the snapshot drifts from the last scored roast, the
Dashboard shows a "score may be out of date" banner and can **re-score from the snapshot** —
`buildRescoreInput` reconstructs the analyze input so the user doesn't re-type (paywall-gated). A
plan-stale "Update" badge does the same for the action plan.

### Scoring (CFPB)
The backend separates AI judgment from deterministic math: the AI extracts numbers, judges tone,
infers CFPB responses, and assigns confidence; **code** computes the CFPB score, savings rate,
DTI, emergency-fund months, and score bands. Scoring lives in `shared/scoring/` (`cfpb_irt.ts`,
`bands.ts`, `index.ts`) and is shared by app + edge functions. Score-band labels/thresholds/colors
come from `shared/scoring/bands.ts` (`getScoreBand`) — never re-encoded elsewhere.

### Edge-function safety
All AI endpoints have a **Groq (Llama 3.3 70B) fallback**, a Postgres-backed fixed-window **rate
limiter** (`_shared/rateLimit.ts`), a 30s upstream timeout + retries, and return structured errors
with a failure `stage` (`parse_error`, `rate_limited`, `upstream_timeout`,
`upstream_unavailable`, `validation_error`, …) so the client shows specific messages.

> **Prompts are static TS imports, never runtime `.txt` reads.** Each function's prompt lives in a
> `prompt.ts` (`export const SYSTEM_PROMPT = …`). A `Deno.readTextFileSync` of a non-imported
> `.txt` isn't in the eszip deploy bundle and crashes the worker on boot. Never re-introduce a
> `.txt` prompt read.

---

## Monetization

New users get **3 days of full free access** to everything. After that it's a **hard paywall —
there is NO permanent free tier**: using the app at all requires a paid plan.

- **Action Plan** — ~$4.99/mo (90-day plan, debt tools)
- **Deep Dive** — ~$9.99/mo (supersedes Action Plan; scenario simulator, deep-dive)

The 3-day access is **app-side** (granted on signup from the server-set `created_at`, hard-gated
after expiry) — **not** an Apple/RevenueCat introductory offer; there's no per-subscription free
trial. RevenueCat's on-device `customerInfo` is the source of truth for entitlements;
`user_subscriptions` is a server-side mirror written only by the `revenuecat-webhook`. The
trial-window math is shared via `shared/entitlement.ts` (app) and
`supabase/functions/_shared/entitlement.ts` (edge). See
**[docs/DECISIONS.md](docs/DECISIONS.md)** and **[docs/REVENUECAT_SETUP.md](docs/REVENUECAT_SETUP.md)**.

---

## Deploying the backend

```bash
# Install + log in once
npm install -g supabase
supabase login
supabase link --project-ref zefhsplmgxefmpdqbbvv

# Edge-function secrets (server-side; never bundled client-side)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set GROQ_API_KEY=gsk-...
supabase secrets set REVENUECAT_WEBHOOK_AUTH=<long-random-string>

# Deploy all 6 edge functions + run migrations
bash tools/deploy-all.sh

# …or individually:
supabase functions deploy analyze
supabase db push
```

`tools/deploy-all.sh` deploys **analyze, action-plan, generate-captions, checkin-reflection,
revise-plan, revenuecat-webhook** and then runs `supabase migration up --linked`.

> The Supabase project is coworker-owned (free tier), ref `zefhsplmgxefmpdqbbvv`. A separate
> **AmIBroke-staging** project (`zgrfgzjnhkellqgqfque`) exists. The hosted DB can lag the migration
> files — a runtime `PGRST204 "column not found"` means a migration wasn't applied remotely.

---

## Migrations

`supabase/migrations/00001` → **00025**, applied via `supabase db push`. Recent, high-value:

| # | What |
|---|------|
| 00022 | `financial_snapshots` — the unified snapshot table |
| 00023 | `check_ins.reflection` — persisted Haiku check-in reflection |
| 00024 | `profiles.preferred_tone` — sticky roast voice (default `savage`) |
| 00025 | `profiles.debt_strategy` — sticky avalanche/snowball (default `avalanche`) |

---

## Environment

Client vars (`EXPO_PUBLIC_*`, in `.env` — see `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | No | PostHog analytics key |
| `EXPO_PUBLIC_POSTHOG_HOST` | No | PostHog host (default US cloud) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | No | RevenueCat iOS SDK key (`appl_…`, or `test_…` in dev) |
| `EXPO_PUBLIC_FEATURE_CREATOR_DASHBOARD` | No | Enable creator tools |

**Server secrets** (via `supabase secrets set`, never in `.env`): `ANTHROPIC_API_KEY`,
`GROQ_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, rate-limit tunables (`RATE_LIMIT_MAX_REQUESTS` /
`RATE_LIMIT_WINDOW_MS`), and the service-role key.

---

## Testing

```bash
npm test                  # jest (jest-expo preset)
npm run test:purchases    # RevenueCat IAP unit test
npx tsc --noEmit          # typecheck the app (fastest correctness signal)
```
Tests live in `src/**/__tests__/` and `shared/*.test.ts`. `tsconfig` excludes `supabase/` and
`tools/` (Deno/Node, not RN). The `tools/eval/*` LLM eval harness and `tools/manual-test.ts` call
paid APIs — see **CLAUDE.md → Critical rules**.

---

## Docs

- **[CLAUDE.md](CLAUDE.md)** — curated working guide (rules, conventions, reuse rules, gotchas)
- **[docs/unified-financial-model.md](docs/unified-financial-model.md)** — the snapshot + onboarding + check-in design
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — architecture decisions + monetization spec
- **[docs/REVENUECAT_SETUP.md](docs/REVENUECAT_SETUP.md)** — RevenueCat setup + free-tier StoreKit testing
- **[docs/TESTING.md](docs/TESTING.md)** — eval methodology + fixtures
- **[docs/active-plan-design.md](docs/active-plan-design.md)** — Model B persistent plan (design-only / parked)
