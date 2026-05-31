# RevenueCat / In-App Purchase Setup

The app's subscription billing was migrated from Stripe to **Apple In-App Purchase via
RevenueCat** (auto-renewable subscriptions, 7-day free trial). The **code is scaffolded
and compiles**, but it cannot be tested or shipped until the external setup below is done.
Until then the app runs normally and treats everyone as **free tier** (RevenueCat init is
guarded on the API key).

## Product model
- `action_plan` — auto-renewable subscription, ~$4.99/mo, 7-day free trial
- `deep_dive` — auto-renewable subscription, ~$9.99/mo, 7-day free trial (supersedes action_plan)

## 1. Apple Developer Program (hard blocker)
- Enroll in the Apple Developer Program ($99/yr). Nothing below works without it.
- In **App Store Connect**: create the app record; complete **Agreements, Tax, and Banking**
  (subscriptions won't load until these are active).

## 2. App Store Connect — subscription products
- Create a **Subscription Group** (e.g. "AmIBroke Premium").
- Add two **Auto-Renewable Subscriptions** with product IDs, e.g.:
  - `com.aibroke.app.action_plan.monthly`
  - `com.aibroke.app.deep_dive.monthly`
- Set pricing and add a **7-day free trial** introductory offer to each.

## 3. RevenueCat dashboard
- Create a project; add the **iOS app** with the App Store **shared secret**.
- **Entitlements:** create `action_plan` and `deep_dive`.
- **Products:** add the two App Store product IDs; attach each to its entitlement.
- **Offerings:** create the current offering with two **packages** whose identifiers are
  `action_plan` and `deep_dive` (the app maps tier → package by identifier; product-id
  match is a fallback — see `packageForTier` in `src/services/purchases.ts`).
- Copy the **public iOS SDK key** → set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in `.env`.

## 4. RevenueCat webhook → Supabase (DB mirror)
- Deploy the function: `npx supabase functions deploy revenuecat-webhook`
- Set its secrets:
  `npx supabase secrets set REVENUECAT_WEBHOOK_AUTH=<long-random-string>`
  (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided to functions automatically.)
- In RevenueCat → Integrations → Webhooks, point the URL at
  `https://zefhsplmgxefmpdqbbvv.supabase.co/functions/v1/revenuecat-webhook`
  and set the **Authorization** header to the same `REVENUECAT_WEBHOOK_AUTH` value.
- Apply the schema change: `npx supabase db push` (migration `00014_subscriptions_revenuecat.sql`
  relaxes the Stripe NOT NULL and adds store/product columns). Safe/additive.

## 5. Rebuild & test
- `npx expo run:ios` (react-native-purchases is a native module — needs a fresh build).
- For local UI testing without App Store Connect, use an Xcode **StoreKit configuration file**.
- For real validation, use **sandbox testers** on a physical device.

## Notes
- The old custom-card `PaymentScreen` was removed (Apple forbids custom card entry for digital
  goods). Purchases now happen on the Paywall via Apple's native sheet.
- A **Restore Purchases** button (Paywall) and **Manage Subscription** entry (Settings) were
  added — both required/expected by App Review.
- Android: set `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` and add a Play Store app in RevenueCat when
  you ship Android. The webhook already maps `play_store`.
