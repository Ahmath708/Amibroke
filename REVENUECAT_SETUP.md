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
- For real validation, use **sandbox testers** on a physical device (requires the paid program).

## 5a. Free testing via RevenueCat Test Store (EASIEST — no $99, no App Store Connect)

RevenueCat's **Test Store** tests the full purchase/entitlement flow without any Apple/Google
setup. (Requires `react-native-purchases` ≥ 9.5.4 — we're on 10.2.0.) This is the recommended
pre-enrollment path; it does **not** use the `.storekit` file (5b is for real-StoreKit testing later).

1. RevenueCat dashboard → **Apps & providers → New → Test Store** → copy the **`test_…`** key.
2. Under **Product Catalog → Products**, create **Test Products** and attach them to entitlements
   `action_plan` / `deep_dive`; add them as packages `action_plan` / `deep_dive` in the **current
   Offering** (same identifiers the code expects).
3. Put the `test_…` key in `.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY`. (The app refuses a `test_`
   key in production builds and warns in dev — see `purchases.ts`. **Swap to the `appl_` key before
   any release/TestFlight build.**)
4. `npx expo run:ios` (still needs a native build for `react-native-purchases`). Tapping a plan
   shows RevenueCat's **simulate purchase** modal (success/fail/cancel) instead of the Apple sheet;
   a simulated success grants the entitlement, flips `useSubscription` to premium, and appears in
   the RevenueCat dashboard.

**Still blocked until the paid program:** the `revenuecat-webhook` → `user_subscriptions` mirror
(Test Store events behave like purchases but real webhook delivery needs a real store), sandbox
testers, TestFlight, release.

## 5b. Free local StoreKit testing (alternative — real StoreKit, no $99)

The repo ships a StoreKit config at **`storekit/AmIBroke.products.storekit`** (two
auto-renewable subs with 7-day trials, product IDs `com.aibroke.app.action_plan.monthly` /
`com.aibroke.app.deep_dive.monthly`). This lets you exercise subscribe / cancel / restore and
entitlement-gating on the **simulator** without a paid Apple account.

1. `npx expo prebuild --clean` then `npx expo run:ios` (the config plugin
   `plugins/withStoreKitConfig.js` auto-wires the `.storekit` file into the Xcode scheme on
   prebuild; it's defensive and never breaks prebuild).
2. **If purchases show no products**, the auto-wire didn't take — set it manually in Xcode:
   **Edit Scheme → Run → Options → StoreKit Configuration → `AmIBroke.products.storekit`**.
3. You still need `EXPO_PUBLIC_REVENUECAT_IOS_KEY` set and the RevenueCat dashboard objects
   (steps 3–6 above) created, since RevenueCat validates the local receipt and serves offerings.
4. Simulate renewals / cancellations / refunds via Xcode **Debug → StoreKit → Manage Transactions**.

**Blocked on the paid program (won't work via local StoreKit):** the `revenuecat-webhook` →
`user_subscriptions` DB mirror (real webhook events only fire from sandbox/production), real
sandbox testers, TestFlight, and release.

## Notes
- The old custom-card `PaymentScreen` was removed (Apple forbids custom card entry for digital
  goods). Purchases now happen on the Paywall via Apple's native sheet.
- A **Restore Purchases** button (Paywall) and **Manage Subscription** entry (Settings) were
  added — both required/expected by App Review.
- Android: set `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` and add a Play Store app in RevenueCat when
  you ship Android. The webhook already maps `play_store`.
