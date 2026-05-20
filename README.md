# 💸 Am I Broke? — Expo React Native App

A viral Gen Z fintech app built with Expo + TypeScript. Drop your financial situation in plain English and get an AI-powered roast + financial health score instantly.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase + Claude (edge function)
1. Create a Supabase project at https://supabase.com
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (copied from Supabase dashboard → Settings → API)
3. Deploy the edge function:
   ```bash
   npx supabase functions deploy analyze
   ```
4. Set the Anthropic key as a secret:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Apply database migrations:
   ```bash
   npx supabase migration up
   ```

### 3. Start the app
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
| Login/Signup | `Login` | Apple/Google/email auth |
| Home | `Home` | Financial input, suggestions |
| AI Processing | `Processing` | Animated analysis |
| Results | `Results` | Score, roast, breakdown |
| 90-Day Action Plan | `ActionPlan` | Checkable weekly goals |
| Debt Payoff | `DebtPayoff` | Avalanche/snowball calc |
| Share Card | `Share` | Shareable result card |
| Paywall | `Paywall` | Premium upsell |
| Payment | `Payment` | Apple Pay style checkout |
| History | `History` (tab) | Past analyses + chart |
| Community | `Community` (tab) | Anonymized roast feed |
| Profile | `Profile` (tab) | Stats + avatar |
| Settings | `Settings` | Toggles + preferences |
| Scenario Simulator | `ScenarioSimulator` | What-if financial scenarios |
| Subscription Audit | `SubscriptionAudit` | Kill unused subs |
| Affiliates | `Affiliate` | Curated financial products |
| Monthly Check-In | `MonthlyCheckIn` | Mood + update tracker |
| Creator Dashboard | `CreatorDashboard` | Referral analytics + earnings |
| Privacy Policy | `PrivacyPolicy` | Legal + data handling |
| Terms of Service | `TermsOfService` | Usage terms |
| Help & FAQ | `HelpFAQ` | Frequently asked questions |

---

## 🎨 Design System

**Theme:** Cinematic Honesty  
**Background:** `#19101c` Deep Wine  
**Primary:** `#ecb2ff` Electric Purple  
**Secondary:** `#b9f1ff` Neon Cyan  
**Fonts:** Space Grotesk (headings) · Inter (body)  
**Style:** Glassmorphism · Neon blooms · Dark mode first

---

## 🧠 AI Integration

Uses **Claude Sonnet** (`claude-sonnet-4-20250514`) via Anthropic API.

The AI analyzes plain-English financial descriptions and returns structured JSON with:
- Financial health score (0–100)
- Spending breakdown by category
- Debt risk assessment
- Personalized roast/reality check
- 90-day action plan steps
- Key financial insights

The edge function returns structured errors with failure stage (`parse_error`, `claude_api_error`, `validation_error`) so the client can display useful error messages.

---

## 📦 Tech Stack

- **Expo** ~53.0.0
- **React Native** 0.79.6
- **TypeScript**
- **React Navigation** v7 (Native Stack + Bottom Tabs)
- **Supabase** — Auth, Edge Functions, Database
- **expo-linear-gradient** — gradients
- **expo-blur** — glassmorphism
- **expo-haptics** — tactile feedback
- **react-native-svg** — score ring chart
- **react-native-reanimated** — animations
- **@expo-google-fonts** — Space Grotesk + Inter

---

## 💰 Monetization

- **Premium Paywall** — Lifetime $19.99 / Monthly $4.99
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
├── assets/
│   ├── icon.png
│   ├── splash.png
│   ├── adaptive-icon.png
│   └── favicon.png
└── src/
    ├── components/
    │   ├── BottomNav.tsx
    │   ├── GlassCard.tsx
    │   ├── NeonButton.tsx
    │   ├── ScoreRing.tsx
    │   ├── StatusPill.tsx
    │   ├── LoadingState.tsx
    │   ├── EmptyState.tsx
    │   └── ErrorState.tsx
    ├── navigation/
    │   └── AppNavigator.tsx
    ├── screens/
    │   ├── SplashScreen.tsx
    │   ├── OnboardingScreen.tsx
    │   ├── LoginScreen.tsx
    │   ├── HomeScreen.tsx
    │   ├── ProcessingScreen.tsx
    │   ├── ResultsScreen.tsx
    │   ├── ActionPlanScreen.tsx
    │   ├── DebtPayoffScreen.tsx
    │   ├── ShareScreen.tsx
    │   ├── PaywallScreen.tsx
    │   ├── PaymentScreen.tsx
    │   ├── HistoryScreen.tsx
    │   ├── ProfileScreen.tsx
    │   ├── CommunityFeedScreen.tsx
    │   ├── SettingsScreen.tsx
    │   ├── ScenarioSimulatorScreen.tsx
    │   ├── SubscriptionAuditScreen.tsx
    │   ├── AffiliateScreen.tsx
    │   ├── MonthlyCheckInScreen.tsx
    │   └── CreatorDashboardScreen.tsx
    ├── context/
    │   └── AuthContext.tsx
    ├── config/
    │   └── features.ts
    ├── services/
    │   └── claudeApi.ts
    ├── theme/
    │   └── colors.ts
    └── types/
        └── index.ts
```
