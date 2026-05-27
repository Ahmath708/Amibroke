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

# Set the Anthropic API key as a secret (required for analysis)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Deploy all edge functions
supabase functions deploy analyze
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
| Share Card | `Share` | Shareable result card (dark/light, tall/square) |
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

Uses **Claude Sonnet 4** (`claude-sonnet-4-20250514`) via Anthropic API with **tool-use** for guaranteed structured output.

The AI analyzes plain-English financial descriptions and returns structured JSON with:
- Financial health score (0–100) computed via **official CFPB IRT formula**
- Confidence-weighted scoring (low/medium/high per response attenuate the score)
- Deterministic server-side metrics (savings rate, DTI, emergency fund months)
- CFPB Financial Well-Being Scale (10 questions, IRT-scored)
- Personalized roast/reality check (5 tone modes)
- Key financial insights, top problems, and positive behaviors
- Mentioned spending categories (user-stated only, never fabricated)

### Architecture

The backend was rebuilt to separate AI judgment from deterministic math:

1. **AI does**: extract numbers, judge tone, infer CFPB responses, assign confidence
2. **Code does**: compute CFPB IRT score, savings rate, DTI, emergency fund months, score bands

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /analyze` | Main analysis — uses Anthropic tool-use, validates with Zod, computes derived metrics + CFPB score |
| `POST /action-plan` | 90-day plan generation — separate endpoint, called when user taps "View Plan" |

### Prompt System

System prompts live in **external `.txt` files** (not embedded in source) for easy editing:
- `supabase/functions/analyze/prompts/system.txt`
- `supabase/functions/action-plan/prompts/system.txt`

Prompts are loaded once at module startup via `Deno.readTextFileSync` and cached with Anthropic's `cache_control: { type: 'ephemeral' }`.

### Testing Infrastructure

| Tool | Purpose |
|------|---------|
| `scripts/eval/runner.ts` | Automated eval harness — 13 fixtures, pass/fail assertions, 40-call hard cap |
| `scripts/eval/fixtures.ts` | 13 test cases across 5 groups (vague, partial, detailed, edge cases, CFPB) |
| `scripts/eval/assertions.ts` | Zod schema validation, confidence distribution checks, forbidden string checks |
| `scripts/manual-test.ts` | Human-review testing with `--input <name>` and `--save` flags |
| `scripts/lib/call-counter.ts` | Shared 40-call session hard cap across all testing scripts |

The edge function returns structured errors with failure stage (`parse_error`, `claude_api_error`, `validation_error`, `tool_use_missing`) so the client can display useful error messages.

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
├── DECISIONS.md               # Architecture decisions log
├── FRONTEND_TODO.md           # Known frontend gaps
├── shared/                    # Shared types & logic (frontend + backend)
│   ├── types.ts               # TypeScript types (inferred from Zod)
│   ├── schemas.ts             # Zod schemas (request, AI output, final response)
│   ├── calculations.ts        # Deterministic financial math
│   ├── calculations.test.ts
│   ├── baselines/             # State + national reference data
│   │   ├── national.ts        # Country-wide defaults (CC APR, student loan rate)
│   │   ├── states.ts          # Per-state rows (50 states + DC, cited sources)
│   │   └── index.ts           # getBaselines(state) helper
│   └── scoring/               # CFPB IRT scoring module
│       ├── cfpb_irt.ts        # Official CFPB graded-response IRT scorer
│       ├── bands.ts           # Score → label/color (Fragile/Surviving/Stable/Thriving)
│       ├── index.ts           # computeFinalScore() with confidence attenuation
│       └── __tests__/
│           └── cfpb.test.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/            # 5 SQL migrations
│   └── functions/
│       ├── analyze/           # Main analysis endpoint (Anthropic tool-use)
│       │   ├── index.ts       # Handler: validate → call AI → compute → return
│       │   ├── tool.ts        # submit_analysis tool JSON Schema definition
│       │   ├── getBaselinesForRequest.ts
│       │   ├── prompts/
│       │   │   └── system.txt # External system prompt (cache-able)
│       │   └── prompt.ts      # DEPRECATED (kept for reference)
│       ├── action-plan/       # 90-day plan endpoint
│       │   ├── index.ts
│       │   ├── tool.ts
│       │   ├── prompts/
│       │   │   └── system.txt
│       │   └── prompt.ts      # DEPRECATED (kept for reference)
│       ├── create-payment-intent/
│       ├── confirm-purchase/
│       └── verify-purchase/
├── scripts/                   # Testing infrastructure
│   ├── lib/
│   │   └── call-counter.ts    # 40-call session hard cap
│   ├── eval/
│   │   ├── fixtures.ts        # 13 eval test cases
│   │   ├── assertions.ts      # Zod + custom assertion helpers
│   │   └── runner.ts          # Eval harness runner
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
- `ANTHROPIC_API_KEY` — Claude API key
- `STRIPE_SECRET_KEY` — Stripe secret key
