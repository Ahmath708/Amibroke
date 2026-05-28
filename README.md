# 💸 Am I Broke? — Expo React Native App

A viral Gen Z fintech app built with Expo + TypeScript. Drop your financial situation in plain English and get an AI-powered roast + financial health score instantly.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```

### 3. Deploy Supabase backend
```bash
# Install Supabase CLI if you haven't
npm install -g supabase
supabase login

# Set the API keys as secrets (required for analysis)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set GROQ_API_KEY=gsk-...   # Optional fallback

# Deploy all edge functions
supabase functions deploy analyze
supabase functions deploy action-plan
supabase functions deploy generate-captions
supabase functions deploy create-payment-intent
supabase functions deploy confirm-purchase
supabase functions deploy verify-purchase

# Apply database migrations
supabase migration up
```

### 4. Start the app
```bash
npx expo start
```
Then press `i` for iOS simulator, `a` for Android, or scan QR with Expo Go.

---

## 📱 Screens (23 total)

| Screen | Route | Description |
|--------|-------|-------------|
| Splash | `Splash` | Animated intro |
| Onboarding | `Onboarding` | 3-slide intro |
| Login/Signup | `Login` | Apple/Google/email auth + terms agreement |
| Home | `Home` | Financial input, suggestions, tone selector |
| AI Processing | `Processing` | Animated analysis with 30s timeout |
| Results | `Results` | Score ring, roast, spending breakdown, insights |
| 90-Day Action Plan | `ActionPlan` | Checkable weekly goals |
| Debt Payoff | `DebtPayoff` | Avalanche/snowball calculator |
| Share Card | `Share` | Shareable result card + 3 AI-generated captions (tap-to-copy) |
| Paywall | `Paywall` | Premium upsell ($4.99/$9.99) |
| Payment | `Payment` | Stripe checkout |
| History | `History` (tab) | Past analyses + score chart + check-ins |
| Community | `Community` (tab) | Anonymized roast feed with reactions |
| Profile | `Profile` (tab) | Stats, avatar, quick menu |
| Settings | `Settings` | Toggles, GDPR, sign out |
| Scenario Simulator | `ScenarioSimulator` | What-if financial scenarios |
| Subscription Audit | `SubscriptionAudit` | Track & cut unused subs (premium) |
| Affiliates | `Affiliate` | Curated financial products |
| Monthly Check-In | `MonthlyCheckIn` | Mood + update tracker (premium) |
| Creator Dashboard | `CreatorDashboard` | Referral analytics (feature-flagged) |
| Privacy Policy | `PrivacyPolicy` | Legal + data handling |
| Terms of Service | `TermsOfService` | Usage terms |
| Help & FAQ | `HelpFAQ` | Frequently asked questions |

---

## 🎨 Design System

**Theme:** Cinematic Honesty — iOS HIG-flavored dark mode  
**Background:** `#19101c` Deep Wine  
**Primary:** `#ecb2ff` Electric Purple  
**Secondary:** `#b9f1ff` Neon Cyan  
**Fonts:** Space Grotesk (headings) · Inter (body)  
**Style:** Glassmorphism · Neon blooms · Dark mode first

---

## 🧠 AI Integration

Uses **Claude Sonnet 4** (`claude-sonnet-4-20250514`) via Anthropic API with **tool-use** for guaranteed structured output. All three endpoints have an automatic **Groq fallback** (Llama 3.3 70B) when Claude is unavailable.

The AI analyzes plain-English financial descriptions and returns structured JSON with:
- Financial health score (0–100) computed via **official CFPB scoring methodology (published lookup table)**
- Confidence-weighted scoring (low/medium/high per response attenuate the score)
- Deterministic server-side metrics (savings rate, DTI, emergency fund months)
- CFPB Financial Well-Being Scale (10 questions, scored via CFPB methodology)
- Personalized roast/reality check (5 tone modes)
- Key financial insights, top problems, and positive behaviors
- Mentioned spending categories (user-stated only, never fabricated)

### Architecture

The backend was rebuilt to separate AI judgment from deterministic math:

1. **AI does**: extract numbers, judge tone, infer CFPB responses, assign confidence, generate share captions
2. **Code does**: compute CFPB score, savings rate, DTI, emergency fund months, score bands, cache results

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /analyze` | Main analysis — uses Anthropic tool-use, validates input, computes derived metrics + CFPB score (3 iteration cycles, 100%) |
| `POST /action-plan` | 90-day plan generation — separate endpoint (3 iteration cycles: confidence anchoring + number anchoring, 100%) |
| `POST /generate-captions` | Share-card caption generation — 3 distinct TikTok-native captions, temperature 0.8 (3 iteration cycles: structural uniqueness + min 100-char, 100%) |

All three endpoints have:
- **Groq fallback** — automatic failover to Llama 3.3 70B when Claude is unavailable
- **Rate limiting** — Postgres-backed fixed-window limiter (30 req/hour/IP, env-tunable)
- **Upstream safety** — 30s fetch timeout via AbortController, max 3 retries, clear error stages

### Prompt System

System prompts live in **two synchronized sources** per function:
- `supabase/functions/*/prompts/system.txt` — canonical text file for easy editing/diffs
- `supabase/functions/*/prompt.ts` — TypeScript export (runtime source; Supabase CLI bundles `.ts`, not `.txt`)

When iterating prompts during eval cycles, edit both files. Content is always verified to match before deploying. Prompts are cached with Anthropic's `cache_control: { type: 'ephemeral' }`.

### Client Persistence

To avoid re-billing on re-views, the client caches results:
- **Captions** — cached in `analyses.share_captions` (JSONB) via `fetchOrGenerateCaptions()`
- **Action plans** — cached in `analyses.action_plan` (JSONB) via `fetchOrGenerateActionPlan()`

Both write only on success, return the cached value on subsequent visits, and fall back gracefully on error.

### Testing Infrastructure

| Tool | Purpose |
|------|---------|
| `scripts/eval/lib/harness.ts` | Shared eval library — runSuite() with cost prompts, raw-output logging, SUMMARY.md |
| `scripts/eval/runner.analyze.ts` | Analyze runner — 13 fixtures across 5 groups (vague/partial/detailed/edge/CFPB) |
| `scripts/eval/runner.action-plan.ts` | Action-plan runner — 8 real-analysis fixtures across 3 Fragile + 5 Surviving + 1 Thriving |
| `scripts/eval/runner.captions.ts` | Captions runner — 6 fixtures spanning low/mid/high scores + 2 savage, 1 of each other tone |
| `scripts/eval/assertions.ts` | Zod schema validation, confidence checks, forbidden strings (word-boundary regex), plan consistency |
| `scripts/eval/results/` | Run output: per-cycle JSON (full raw responses) + SUMMARY.md — 9 cycles across 6 suites |
| `scripts/lib/call-counter.ts` | Shared 40-call session hard cap across all testing scripts |
| `scripts/manual-test.ts` | Human-review testing with `--input <name>` and `--save` flags |

All edge functions return structured errors with failure stage (`parse_error`, `rate_limited`, `upstream_timeout`, `upstream_unavailable`, `claude_api_error`, `groq_api_error`, `validation_error`, `tool_use_missing`) so the client can display specific error messages.

### Rate Limiting

Postgres-backed fixed-window rate limiter shared across all three endpoints:
- **Table:** `api_rate_limits` (bucket_key + window_start composite PK)
- **Logic:** `check_rate_limit(p_key, p_max, p_window_seconds)` RPC — self-prunes stale windows
- **Defaults:** 30 requests/hour/IP/endpoint (env-tunable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SECONDS`)
- **Bypass:** Set `RATE_LIMIT_ENABLED=false` for local testing
- **Fail-open:** RPC errors log a warning and allow the request (switchable to fail-closed)
- **Separation:** Pure logic in `rateLimitLogic.ts` (testable without Deno), IO in `rateLimit.ts`

---

## 📦 Tech Stack

- **Expo** ~54.0.0
- **React Native** 0.81.5
- **TypeScript** ~5.9
- **Zod** — response validation
- **React Navigation** v7 (Native Stack + Bottom Tabs)
- **Supabase** — Auth, Edge Functions, Database (Postgres)
- **Anthropic Claude** — AI analysis
- **Stripe** — Payments
- **PostHog** — Analytics
- **expo-linear-gradient** — gradients
- **expo-blur** — glassmorphism
- **expo-haptics** — tactile feedback
- **react-native-svg** — score ring chart
- **react-native-reanimated** — animations
- **@expo-google-fonts** — Space Grotesk + Inter

---

## 💰 Monetization

- **Action Plan** — $4.99 one-time (90-day roadmap, weekly goals, debt strategy)
- **Deep Dive** — $9.99 one-time (scenario simulator, avalanche vs snowball, PDF report)
- **Affiliate Recommendations** — Financial products
- **Creator Referral System** — Earn per signup

---

## 🗂 Project Structure

```
AmIBroke/
├── App.tsx                    # Root entry point
├── app.json                   # Expo config
├── package.json
├── tsconfig.json
├── babel.config.js
├── .env.example
├── CLAUDE.md                  # AI safety rules
├── DECISIONS.md               # Architecture decisions + iteration hypotheses log (analyze, action-plan, captions)
├── 528_NEXT_STEPS.md          # Action-plan + captions iteration plan (✅ complete)
├── FRONTEND_TODO.md           # Known frontend gaps
├── shared/                    # Shared types & logic (frontend + backend)
│   ├── types.ts               # TypeScript types (inferred from Zod)
│   ├── schemas.ts             # Zod schemas (request, AI output, caption, final response)
│   ├── index.ts               # Re-exports everything
│   ├── calculations.ts        # Deterministic financial math
│   ├── calculations.test.ts
│   ├── baselines/             # State + national reference data
│   │   ├── national.ts        # Country-wide defaults (CC APR, student loan rate)
│   │   ├── states.ts          # Per-state rows (50 states + DC, cited sources)
│   │   └── index.ts           # getBaselines(state) helper
│   └── scoring/               # CFPB scoring module
│       ├── cfpb_irt.ts        # Official CFPB graded-response scorer
│       ├── bands.ts           # Score → label/color (Fragile/Surviving/Stable/Thriving)
│       ├── index.ts           # computeFinalScore() with confidence attenuation
│       └── __tests__/
│           └── cfpb.test.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/            # 9 SQL migrations (00001–00009)
│   └── functions/
│       ├── _shared/           # Shared edge function utilities
│       │   ├── rateLimit.ts   # Postgres-backed rate limiter (IO via supabase-js)
│       │   └── rateLimitLogic.ts  # Pure logic: bucket key, limit resolution, bypass
│       ├── analyze/           # Main analysis endpoint
│       │   ├── index.ts       # Handler: validate → call AI → compute → return
│       │   ├── tool.ts        # submit_analysis tool JSON Schema
│       │   ├── getBaselinesForRequest.ts
│       │   ├── prompt.ts      # System prompt as TS string
│       │   └── prompts/
│       │       └── system.txt # Source prompt file
│       ├── action-plan/       # 90-day plan endpoint
│       │   ├── index.ts
│       │   ├── tool.ts
│       │   ├── prompt.ts
│       │   └── prompts/
│       │       └── system.txt
│       ├── generate-captions/ # Share-card caption generator
│       │   ├── index.ts       # Temperature 0.8, tool-use, Groq fallback
│       │   ├── tool.ts        # submit_captions tool JSON Schema
│       │   ├── prompt.ts      # Caption-specific system prompt
│       │   └── prompts/
│       │       └── system.txt
│       ├── create-payment-intent/
│       ├── confirm-purchase/
│       └── verify-purchase/
├── scripts/                   # Testing infrastructure
│   ├── lib/
│   │   └── call-counter.ts    # 40-call session hard cap
│   ├── eval/
│   │   ├── lib/
│   │   │   └── harness.ts     # Shared runSuite() — cost prompts, raw output, SUMMARY.md
│   │   ├── runner.analyze.ts  # Analyze runner (13 fixtures, score extraction)
│   │   ├── runner.action-plan.ts  # Action-plan runner (wired, fixtures in 528)
│   │   ├── runner.captions.ts # Captions runner (8 fixtures)
│   │   ├── fixtures.analyze.ts    # 13 analyze test cases (5 groups)
│   │   ├── fixtures.captions.ts   # 8 caption test cases (all tones + scores)
│   │   ├── assertions.ts      # assertAnalyze, assertCaptions, assertActionPlan
│   │   └── results/           # Raw output per run (JSON) + SUMMARY.md
│   ├── manual-test.ts         # Human-review test tool
│   ├── test-snapshots/
│   │   ├── inputs/            # 5 starter input fixtures (JSON)
│   │   ├── outputs/           # Saved AI responses (committed)
│   │   └── REVIEW.md          # Manual review ratings
│   └── test_anthropic.ts      # DEPRECATED
└── src/
    ├── components/            # Reusable UI primitives
    │   ├── GlassCard.tsx
    │   ├── NeonButton.tsx
    │   ├── ScoreRing.tsx
    │   ├── StatusPill.tsx
    │   ├── LoadingState.tsx
    │   ├── EmptyState.tsx
    │   ├── ErrorState.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── Disclaimer.tsx
    │   ├── Toast.tsx
    │   └── TypingPlaceholder.tsx
    ├── navigation/
    │   └── AppNavigator.tsx   # Stack + Bottom Tab navigator
    ├── screens/               # 23 screens
    ├── context/
    │   └── AuthContext.tsx    # Supabase auth state
    ├── hooks/                 # 7 custom hooks
    ├── services/              # API + business logic
    ├── lib/
    │   └── validations.ts     # Zod schemas
    ├── config/
    │   ├── features.ts        # Feature flags
    │   └── scoring.ts         # Score weights + bands
    ├── theme/
    │   └── colors.ts          # iOS HIG design tokens
    └── types/
        └── index.ts           # TypeScript interfaces
```

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `EXPO_PUBLIC_POSTHOG_KEY` | No | PostHog analytics key |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `EXPO_PUBLIC_FEATURE_CREATOR_DASHBOARD` | No | Enable creator tools |

**Supabase secrets** (set via CLI, not in `.env`):
- `ANTHROPIC_API_KEY` — Claude API key (required)
- `GROQ_API_KEY` — Groq API key for fallback (recommended)
- `RATE_LIMIT_MAX` — Max requests per window (default: 30)
- `RATE_LIMIT_WINDOW_SECONDS` — Window duration (default: 3600)
- `RATE_LIMIT_ENABLED` — Set `false` to bypass rate limiter locally
- `STRIPE_SECRET_KEY` — Stripe secret key
