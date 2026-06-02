# May 27 — iOS Readiness Pass (Jason's checklist)

**This is mine, not the coworker's.** It's the boss-mandated pass to make the frontend genuinely iOS-suitable. **iOS is the sole deploy target.** It's done on the Mac (iPhone SE Simulator as primary) + the physical iPhone 14 Pro, **after 529's content has landed** on the screens. Fixes I find that are pure RN code can be handed to the coworker as precise prompts (they can't see iOS); iOS-config/device issues are mine.

**Prereqs:** 529 done (screens surface the backend data, built responsive-by-construction), CLIENT_FIX_PROMPTS Part A done.

**Why a dev build, not Expo Go:** the app uses native modules that aren't in Expo Go (`react-native-view-shot`, `posthog-react-native`), so Expo Go won't fully run it. `npx expo run:ios` produces the dev build that does. This is not a "port" — it's the same JS screens compiled for iOS; I'm not rewriting anything in Swift.

---

## 0. Mac Day-1 Setup

**Read this first.** Walkthrough for getting from "Mac just unlocked" to "ready to start the §1 SE-first sweep" — written for a Mac that's partially set up (has been used for some dev before, but not necessarily iOS-specific). Target time: ~90 min if Xcode isn't already installed (Xcode download dominates); ~30 min if it is. Apple-Silicon assumed (confirm via  → About This Mac → M-series chip).

### 0.1 — Verify what's already on the Mac

Run these one at a time. Anything that returns "command not found" or an error gets installed in §0.2.

```
xcode-select -p          # expect: /Applications/Xcode.app/Contents/Developer
clang --version          # expect: Apple clang version ...
brew -v                  # expect: Homebrew 4.x.x
node -v                  # expect: v20.x.x or higher (Expo SDK 54 minimum: v18)
npm -v                   # expect: 10.x or higher
pod --version            # expect: 1.15.x or higher
watchman --version       # expect: 2024.x or higher
git --version            # expect: 2.x (comes with Xcode CLI tools)
```

If Xcode itself isn't open-able yet (App Store still downloading), continue — install starts now in parallel.

### 0.2 — Install what's missing

Do these in order; later steps depend on earlier ones being present.

**Xcode** (~15 GB, can take 30–60 min): App Store → search "Xcode" → install. **Kick this off first** and do the rest while it downloads. After install, open Xcode once so it provisions, then:
```
sudo xcodebuild -license accept
```
(Skipping this causes every later build to fail with a cryptic license error — bites everyone once.)

**Xcode CLI tools** (separate from Xcode itself):
```
xcode-select --install
```

**Homebrew** (only if `brew -v` failed):
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Follow the post-install instructions to add brew to PATH (it'll print two `eval` lines to copy into `~/.zprofile`).

**Node 20 + Watchman + CocoaPods** (skip whichever are already present):
```
brew install node@20 watchman cocoapods
brew link --overwrite node@20    # only if node was missing
```
**Important:** install CocoaPods via `brew`, NOT `sudo gem install cocoapods`. The gem path has known ABI issues on Apple Silicon that cause Pod install failures during `expo run:ios`.

Re-run §0.1's verification block; everything should now return a version.

### 0.3 — Clone the repo (with GitHub credential swap)

The Mac's git is likely already authenticated to your **personal** GitHub account. The repo lives under the `jlouie6`-accessible account, so credentials need to be swapped. Simplest approach is HTTPS + Personal Access Token (PAT) per-clone:

1. **Clear cached personal credentials** so the next clone prompts fresh:
   ```
   git credential-osxkeychain erase
   host=github.com
   protocol=https
   [press Enter twice to submit]
   ```
   (Or: Keychain Access app → search "github" → delete any entries.)

2. **Get the clone URL** from your Windows machine — run `git remote -v` in the existing Amibroke repo there and copy the HTTPS URL. (Should be `https://github.com/<owner>/<repo>.git`.)

3. **Generate a PAT** on the `jlouie6` GitHub account: github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new → `repo` scope, 90-day expiry, copy the token (you only see it once).

4. **Clone with the swapped credentials:**
   ```
   git clone https://github.com/<owner>/<repo>.git
   cd <repo>
   ```
   When prompted: username `jlouie6`, password = paste the PAT.

5. **Pin git identity per-repo** so future commits attribute to `jlouie6`, not your personal identity:
   ```
   git config user.name "jlouie6"
   git config user.email "jason.louie.614@gmail.com"
   ```

6. **Install dependencies:**
   ```
   npm install
   ```
   Slow first time (~3–5 min). If it errors on a native dep, check Node is v20+ (`node -v`).

> **Optional, only if you want clean separation long-term:** instead of HTTPS+PAT, generate a dedicated SSH key for `jlouie6` (`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_jlouie6`), add the pub key to the `jlouie6` GitHub account, configure `~/.ssh/config` with a `Host github-jlouie6` alias pointing at that key, and clone via `git@github-jlouie6:<owner>/<repo>.git`. More setup, but you don't re-enter PATs or worry about token expiry. Not necessary for this pass.

### 0.4 — Wire env vars (only 2 values needed from coworker's Supabase)

The client only reads two `EXPO_PUBLIC_*` vars at runtime (verified via grep of `src/`). Everything else is server-side and already lives as Supabase Edge Function secrets on the coworker's project — none of those touch the Mac.

1. **Create `.env` from the template:**
   ```
   cp .env.example .env
   ```

2. **Open the coworker's Supabase dashboard** → Settings → API. Grab:
   - **Project URL** → paste as `EXPO_PUBLIC_SUPABASE_URL` value
   - **anon / public** key (NOT service_role) → paste as `EXPO_PUBLIC_SUPABASE_ANON_KEY` value

3. **Edit `.env`** to look like this — leave PostHog and Stripe lines as the template defaults or comment them out:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<his-project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...   # long JWT
   EXPO_PUBLIC_FEATURE_CREATOR_DASHBOARD=false
   ```
   The Stripe publishable key in `.env.example` is reserved for future native Stripe SDK integration — not currently read in `src/`. Skip it.

4. **Verify `.env` is gitignored** (paranoia check):
   ```
   git check-ignore .env     # should print: .env
   ```
   If it doesn't print anything, `.env` would be committable — STOP and add it to `.gitignore` before going further.

5. **Send the coworker this one-line confirmation message** (paste into WhatsApp/wherever):

   > "Setting up the iOS dev build on my Mac. Can you confirm: (1) on your Supabase project, Edge Function secrets `STRIPE_PRICE_ID_ACTION_PLAN` and `STRIPE_PRICE_ID_DEEP_DIVE` are set, (2) `STRIPE_WEBHOOK_SECRET` is set, (3) your Stripe is in **test mode** (publishable key starts with `pk_test_`). Won't run a live Checkout smoke until you confirm — don't want to charge anything real."

6. **Confirm `USE_AI_MOCKS` default** in [src/config/ai.ts](src/config/ai.ts):
   ```
   export const USE_AI_MOCKS = __DEV__ && true;
   ```
   This is what you want for the §1 layout sweep — zero API calls, deterministic fixtures, free.

### 0.5 — First build

```
npx expo run:ios
```

What happens, in order: Expo prebuilds (generates `ios/` from `app.json`), installs Pods (slow on first build, ~3–5 min — this is where most first-time failures happen), Xcode builds the dev client, Simulator launches with Am I Broke installed and opens to Splash → Login.

**Success looks like:** Simulator window pops up, app launches, Login screen renders, Metro shows "Bundling complete" and a steady "Waiting on connections" state in the terminal.

**Top 5 failure modes + one-line fix:**

| Error you'll see | Fix |
|---|---|
| `xcrun: error: command line tools not found` | `xcode-select --install` (§0.2 step skipped) |
| `Xcode requires you to accept the license agreement` | `sudo xcodebuild -license accept` |
| `pod install` hangs or fails on `ffi`/`hermes-engine`/`ExpoModulesCore` | You used `gem install cocoapods`. Run `brew uninstall cocoapods --ignore-dependencies; brew install cocoapods`, then `cd ios && pod install` |
| `Port 8081 in use` / Metro won't start | `lsof -ti :8081 \| xargs kill -9`, re-run |
| `No bundle URL present` in red on Simulator | Metro is running but the Simulator can't reach it — kill all node procs (`killall node`), close Simulator, re-run `npx expo run:ios` |

**Keep `ios/` gitignored.** Expo regenerates it via prebuild every time you change native config (`app.json`, plugins). Don't hand-edit `ios/` files or you fork into native maintenance the coworker can't help with from Windows.

### 0.6 — Multi-Simulator setup

Open Simulator (it auto-launches with `expo run:ios`, or via Xcode → Open Developer Tool → Simulator). Then:

- Simulator menu bar → File → New Simulator → **iPhone SE (3rd generation)** + iOS 17 (or latest) → Create. This is your **primary** target — smallest screen, fewest pixels, where layout breaks first.
- Repeat for **iPhone 14 Pro** + same iOS — secondary for Dynamic Island / notch verification.
- Switch between them via File → Open Simulator → pick device.
- For fast iteration, run `npx expo run:ios --simulator "iPhone SE (3rd generation)"` to lock-target the SE.

### 0.7 — Physical 14 Pro sideload (free Apple ID)

You have a free Apple ID, no paid Developer Program. Sideloading works, but the cert expires every 7 days — if this pass takes more than a week, re-run `expo run:ios --device` to redeploy.

1. Connect the 14 Pro via USB → on the iPhone tap "Trust this computer".
2. Open Xcode → Xcode menu → Settings → Accounts → `+` → Apple ID → sign in with your Apple ID. A "Personal Team" appears under your account.
3. Open the generated workspace in Xcode: `open ios/<workspace-name>.xcworkspace` (or double-click in Finder). Workspace name matches the slug in `app.json`.
4. In Xcode: select the app target → **Signing & Capabilities** tab → **Team** dropdown → choose "<Your Name> (Personal Team)". Change **Bundle Identifier** to something unique like `com.jlouie6.ambroke` (the default may already be in use under another Apple ID).
5. Back in terminal: `npx expo run:ios --device` → pick the 14 Pro from the device list.
6. On the iPhone: Settings → General → VPN & Device Management → tap your developer profile → **Trust**.
7. Open the app on the 14 Pro. App will work for 7 days, then fail to launch — re-run step 5 to redeploy.

### 0.8 — Day-1 sanity checks (do these before §1)

In order — each step proves the next one is worth trying:

- [ ] App launches in SE Simulator → Login screen visible. ✅ Build pipeline works.
- [ ] Create a test account or log in with one → lands on Home (or wherever auth routes). ✅ Supabase wiring works.
- [ ] With `USE_AI_MOCKS = true` still set: Home → fill in mock prompt → Submit → Processing → **Results renders** with the stub fixture data. ✅ Screens render the schema-validated fixtures correctly.
- [ ] **One-shot live smoke** to prove the edge function path is wired (not just mocks): edit [src/config/ai.ts](src/config/ai.ts) → `USE_AI_MOCKS = __DEV__ && false`, save, let Metro fast-refresh, run one real analyze. Watch the Network/Console for the call to `<supabase-url>/functions/v1/analyze`. Expect Results to render with **different** (live-generated) content. Then **edit back to `true`** before starting §1 — this is the single live call you need for this pass; everything else is mocks.
- [ ] Metro console clean — no red errors, no missing module warnings.
- [ ] **Defer Stripe live smoke** to §2.a — you'll do it as part of the Paywall/Payment verification, after the layout sweep, and only after the coworker has confirmed the §0.4 step-5 message.

If any of these fail, fix before proceeding — §1 onward assumes a working build. Common gotchas in §0.9.

### 0.9 — Top 5 Day-1 gotchas (quick-reference)

1. **Xcode license error** during build → `sudo xcodebuild -license accept`.
2. **Pod install fails on M-series** → use `brew install cocoapods`, never `sudo gem install cocoapods`. If already broken, `brew uninstall cocoapods --ignore-dependencies && brew install cocoapods && cd ios && pod install`.
3. **Port 8081 in use** → `lsof -ti :8081 | xargs kill -9`, re-run `expo run:ios`.
4. **Simulator stuck on boot / black screen** → Simulator menu → Device → Erase All Content and Settings → re-launch.
5. **"No bundle URL present"** in the Simulator → Metro can't reach Simulator (firewall or stale state). `killall node`, close Simulator, re-run `npx expo run:ios`. If it persists, `npx expo prebuild --clean` to nuke and regenerate `ios/`.

> **Reminder from Windows side:** the coworker's `expo export --platform android` is only a free resolution/type check on Windows — NOT a deploy. Android is not shipped. The real build is the iOS dev build above.

---

## 1. Global / app-wide

- [ ] `SafeAreaProvider` at the root; `useSafeAreaInsets` on screens that touch the top/bottom edges.
- [ ] **Top inset:** verify both the 14 Pro (Dynamic Island) and SE (plain status bar, smaller inset) — content not hidden under either.
- [ ] **Bottom inset:** home-indicator clearance on modern devices; SE (home button) has no bottom inset — verify tappable controls aren't jammed against the edge on either.
- [ ] Status-bar style correct per screen (light content on dark backgrounds).
- [ ] App icon + splash render correctly on iOS aspect ratios; no white flash on launch (`expo-splash-screen`).
- [ ] Fonts (`Inter`, `Space Grotesk` via `expo-font`) load on iOS with no fallback-flash.
- [ ] iOS **swipe-back** gesture works across the stack; headers/back behave natively.
- [ ] Orientation locked to portrait (if that's the intent) in the iOS config.

---

## 2. Per-screen SE-first sweep (open each on the iPhone SE Simulator)

For every screen check: no clipping/overflow, tall content scrolls, text wraps/ellipsizes, touch targets ≥44pt, spacing not cramped, safe areas respected.

- [ ] **HomeScreen** (freeText + tone select): `KeyboardAvoidingView` (iOS `behavior="padding"`); input not covered by keyboard; tap-outside / "Done" dismisses.
- [ ] **ProcessingScreen / SplashScreen**: animations smooth, no jank, durations feel right on device.
- [ ] **ResultsScreen** (densest — 529 FE3/FE4): score gauge not clipped; all six metrics + lists + confidence badges fit via scroll on SE; longest summary/roast wraps.
- [ ] **ActionPlanScreen**: `overallMessage` + steps fit; category/confidence badges legible; long descriptions wrap.
- [ ] **DebtPayoffScreen**: debt rows fit; urgency colors visible and contrasting.
- [ ] **ShareScreen**: the share **card** (`react-native-view-shot`) captures correctly on iOS — verify the exported image isn't cut off / mis-scaled (view-shot has iOS quirks); caption tap-to-copy works; share sheet (`expo-sharing`) opens.
- [ ] **HistoryScreen**: list + detail render persisted analysis/plan/captions; empty state.
- [ ] **ScenarioSimulator, MonthlyCheckIn, Settings, Profile, Onboarding/Landing/Login**: quick overflow + safe-area + touch-target pass.
- [ ] **Paywall / Payment**: verify carefully on device (purchase flow + layout) — money screens get extra scrutiny. **Also run the Stripe Checkout return-path verification below — there's a known incomplete piece in the FE10 wiring.**

### 2.a — Stripe Checkout deep-link return (known FE10 gap to verify)

**Context (so you don't have to remember why this is here):** when the coworker shipped FE10 he wired the *forward* path correctly — `src/screens/PaymentScreen.tsx` calls `createCheckoutSession(product)` from `@/services/subscriptions` and opens the returned URL — but the *return* path was left incomplete:
- `app.json` has no `expo.scheme` registered.
- No `Linking.addEventListener` exists anywhere in `src/`.
- PaymentScreen uses `Linking.openURL(url)` (system Safari, full app context switch) instead of `WebBrowser.openBrowserAsync(url)` (in-app browser whose await resolves on dismiss).

Functional impact: subscription state still gets correct eventually, because `useSubscription` re-fetches on app foreground (via its `AppState` listener) — so when the user manually switches back to the app, it catches up. UX impact: the user has to manually switch back; there's no auto-return; no instant plan-badge update; not the polished SaaS flow it should be.

**Test on the iPhone SE Simulator (Stripe test mode — no real charges):**

- [ ] Sign in as a test user, navigate to Paywall, tap Subscribe on one of the plans.
- [ ] Observe: does Stripe Checkout open in an **in-app browser overlay** (sheet over the app), or does Safari **pop out** to a separate app? In-app sheet = the WebBrowser swap is done; full pop-out = still on `Linking.openURL`.
- [ ] Pay with test card `4242 4242 4242 4242`, any future expiry date, any 3-digit CVC, any postal code.
- [ ] After Stripe's success page, observe: does the app **automatically return** to itself with the plan badge / Manage Subscription state updated? Or do you have to manually swipe back to the app?
- [ ] Repeat the cancel path: Subscribe → Cancel inside Stripe Checkout → does the app auto-return to the Paywall?

**Symptoms of the gap (what you'll see if it's still unwired):**
- Stripe Checkout pops out to system Safari instead of opening an overlay.
- After payment, you're left in Safari on Stripe's success page; the app is in the background.
- When you manually switch back to the app, plan state updates within ~1 second (the `useSubscription` foreground listener catches it) — but there's no automatic transition.

**If the gap is closed:** in-app browser, auto-return, instant state refresh on success path, auto-back-to-Paywall on cancel. Tick the checkbox above and move on to §3.

**If the gap is still there:** log it in your §6 issues list and hand the coworker this fix prompt (copy-paste ready):

```
Close the Stripe Checkout return-path gap on FE10. Three changes:

1. `app.json` — add `"scheme": "ambroke"` inside the `"expo": { ... }` block (alongside `name`, `slug`, `version`, etc.) so iOS knows how to route `ambroke://` deep links back into the app.

2. `src/screens/PaymentScreen.tsx` — replace `await Linking.openURL(url)` (around line 51, right after `await createCheckoutSession(product)`) with:
       const result = await WebBrowser.openBrowserAsync(url);
       refetch();
   Add imports at the top:
       import * as WebBrowser from 'expo-web-browser';
       import { useSubscription } from '@/hooks/useSubscription';
   Inside the component body, pull `refetch` from the hook:
       const { refetch } = useSubscription();
   The `WebBrowser.openBrowserAsync` await resolves when the user dismisses the in-app browser; `refetch()` immediately syncs subscription state. `expo-web-browser` is already in package.json — no install needed.

3. Add a Linking listener at the top-level app entry — likely `App.tsx` or `src/navigation/AppNavigator.tsx` (read both, pick the one that already manages mount-level side effects):
       import * as Linking from 'expo-linking';
       import { useEffect } from 'react';
       // ... inside the component:
       useEffect(() => {
         const handle = ({ url }: { url: string }) => {
           const parsed = Linking.parse(url);
           if (parsed.hostname === 'billing' && parsed.path === '/success') {
             // route back to MainTabs/Home; trigger useSubscription refetch via your auth context or a navigation ref
           } else if (parsed.hostname === 'billing' && parsed.path === '/cancel') {
             // route back to Paywall
           }
         };
         const sub = Linking.addEventListener('url', handle);
         Linking.getInitialURL().then(url => { if (url) handle({ url }); });
         return () => sub.remove();
       }, []);

Verify on the SE Simulator after the changes:
- Paywall → Subscribe → 4242 4242 4242 4242 + future expiry + any CVC → the success page closes itself and the app shows the updated plan badge.
- Paywall → Subscribe → tap Cancel inside Stripe Checkout → the in-app browser dismisses and you're back at the Paywall.
- `npx tsc --noEmit` clean; `npx expo export --platform android` clean (resolution smoke test only; Jason runs the iOS verify).

Show me the `app.json` diff, the `PaymentScreen.tsx` diff (import additions + `Linking.openURL` → `WebBrowser.openBrowserAsync` + `refetch()` call), the deep-link listener diff (in whichever file), and the simulator test result.
```

After the coworker ships the fix, re-run the test procedure above and tick the checkbox.

---

## 3. Accessibility / Dynamic Type

- [ ] Raise iOS text size to a large accessibility setting; confirm no clipping/overlap on the dense screens (Results, ActionPlan). Decide per-element: allow scaling vs. cap with `allowFontScaling`/`maxFontSizeMultiplier`.
- [ ] Color contrast adequate for band colors and urgency colors against their backgrounds.

---

## 4. iOS interactions / polish

- [ ] Haptics (`expo-haptics`) fire appropriately, not excessively.
- [ ] Keyboard dismisses on scroll / tap-outside on input screens.
- [ ] Scroll bounce / pull-to-refresh feel native.
- [ ] Privacy/Terms and any external links open correctly (`expo-web-browser` / linking).

---

## 5. Physical 14 Pro device pass

- [ ] Dynamic Island doesn't collide with top content.
- [ ] Home-indicator gesture area not overlapped by tappable controls.
- [ ] Real-touch feel + scroll performance acceptable; reanimated screens smooth.
- [ ] Share sheet + share-card image look right when actually shared.

---

## 6. Logging + delegating fixes

- [ ] Keep an issues list: **screen → problem → fix**.
- [ ] For each fix that is **pure RN code** (layout, wrapping, safe-area, touch target): write the coworker a precise prompt (exact file + change). They apply it and verify tsc + android-export; I re-verify on the SE Simulator.
- [ ] iOS-config / native / device-only issues: I handle directly.

---

## 7. Later milestone (NOT this pass) — iOS distribution

Flagged so it's on the radar, not done now:
- [ ] **EAS Build** (cloud) → **TestFlight** → App Store. iOS-only.
- [ ] Requires **Apple Developer Program ($99/yr)**, a bundle identifier, signing (EAS manages certs/profiles), and App Store assets (screenshots, description, privacy labels).
- [ ] Separate effort — revisit once the responsive/iOS-feel pass is signed off.

---

## Done =

Every screen passes the **SE Simulator sweep** + a **14 Pro device pass**; safe areas, keyboard avoidance, Dynamic Type, touch targets, and the share-card all verified on real iOS. (tsc + android-resolution stay green from 529.) Distribution is a separate milestone (§7).
