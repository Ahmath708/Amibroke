# Post-Onboarding Audit — 2026-06-11

**Scope:** every post-onboarding screen (~20) on the **iPhone 16e** sim (390×844, small worst-case).
Two parallel passes: a **visual** pass (live screenshots graded against `docs/design-doctrine.md`) and a
**code** pass (5 agents vs the CLAUDE.md reuse rules + doctrine + `react-native-patterns`).
**Recommend-only** except one approved edit (Paywall scroll).

**Severity:** **P0** = broken / demo-blocker / correctness · **P1** = clear quality/reuse/doctrine ·
**P2** = polish/nit.

**Verdict:** strong visual shape overall — the disciplined-neon brand holds across every screen, and the
score-ring hero, bento Dashboard, Community feed, Share card, Debt Payoff, and the ActionPlan build
animation are genuinely good. Debt concentrates in four areas: (1) a cross-cutting **scroll / safe-area**
issue, (2) pervasive **primitive-reuse drift** (`TouchableOpacity`, Ionicons, ad-hoc `$`), (3) a few
**thin-view / correctness** smells, and (4) **sparse/empty** layouts on a handful of screens.

---

## 🔄 Handoff — resolved by session 2 (`redesign`, as of 2026-06-12)

_Second Claude session's progress so the main session doesn't repeat work. Commits: `6e51818`
(audit sweep B–F + Profile hero + Community), `e26a5ee` (Profile/Settings merge). `tsc` clean.
**Anything not listed here is still open.**_

**Cross-cutting — done:**
- ✅ **CC-1** solid safe-area scrim (`components/TopScrim.tsx`, opaque) — Dashboard + all header-less
  tab screens (Tools, Roast, Community, Profile, Paywall). *Pushed screens (Results/History) carry a
  nav header — verify whether they still need it.*
- ✅ **CC-2** `TouchableOpacity` → `PressableScale` — done across in-scope screens. Remaining are
  out-of-scope: auth (Landing/Login), the `AppNavigator` tab bar, `ErrorBoundary`.
- ✅ **CC-3** Ionicons → Heroicons — done, with **documented exceptions kept**: `snow-outline`
  (Snowball, DebtPayoff), `ellipse-outline`, Results financial-metric rows, AppNavigator tab icons.
  Residual Ionicons still in **Results / MonthlyCheckIn / DebtPayoff** — confirm they're only the exceptions.
- ✅ **CC-4** ad-hoc `$` → `@/utils/format` (+ `formatCompactCurrency`).
- ✅ **CC-8** dead code — Trend, Profile `TextInput`, Settings `LinearGradient`, RoastComposer `score*`
  keys, FinancialContextForm `CTX_COLUMNS`.

**Cross-cutting — partial:**
- ◐ **CC-5** thin-view: Dashboard sparkline extracted (`components/Sparkline.tsx`). *Open:* ActionPlan
  plan-gen, Results 50/30/20, Paywall CTA, EditProfile supabase.
- ◐ **CC-6** entitlement: Results P0 → `useSubscription().hasAccess` ✅; Profile `isSubscriptionPremium`
  → hook ✅. *Open:* EditProfile's 5 direct `supabase.*` calls.
- ◐ **CC-9** correctness: Results `opacity:0` → Reanimated `entering` ✅. *Open:* Share captions
  tone/clipboard, MonthlyCheckIn `runReScore` drift.
- ◐ **CC-10** IconBadge removed (Profile/Settings now bare icons) ✅. *Open:* `›` chevron glyph,
  `insets+24`, `getScoreBand` off-palette hexes.

**Cross-cutting — untouched (open):** CC-7 (FlatList: SubscriptionAudit, DebtPayoff) · CC-11 (keyboard
insets: EditProfile, FinancialContext, RoastComposer) · CC-12 (sparse space: Tools, Notifications, Trend,
SubscriptionAudit empty-state).

**Per-screen — fully done:** **Dashboard** · **Community** · **Profile** · **Settings** (merged into
Profile as one Cash-App-style account hub — `components/AccountSettings.tsx`; `SettingsScreen.tsx` +
the `Settings` route **deleted**) · **Roast composer** (the two removals) · **Results** (P0 + entrance +
icons + `$`; P2 nits remain). The **[DISCUSS] Profile → Your Plan** item is resolved (split into
**Plans & Features** + **Manage Subscription**).

**Per-screen — still open for main session:** Subscription Audit · Debt Payoff (segmented control,
FlatList) · Action Plan (plan-gen extraction) · Scenario Simulator (EmptyState reuse) · Share (demo
caption/score mismatch, clipboard) · Edit Profile (supabase calls, Alerts, keyboard) · Financial Context
(bracket≠exact, silent goBack) · Paywall residuals (vestigial grabber, `✓/—` glyphs) · Monthly Check-In
(runReScore, the snapshot-merge data inconsistency — tracked in PROJECT-STATUS) · Trend (sparse) · History (P2).

---

## ✅ Done this pass (approved)

**Paywall scrollability** — root-caused and fixed. It was a `formSheet` whose drag gesture ate the inner
`ScrollView`; the screen's *own* comment flagged why — scroll passthrough needs the ScrollView to be the
screen's first child, but `ScreenBackground` is first (RNScreens #2687/#3092). Swapped the route to
ShareScreen's proven `card` + `slide_from_bottom` (`AppNavigator.tsx`, `name="Paywall"`). Verified
scrollable end-to-end on device (hero → plan picker → full comparison table → CTA → legal); `tsc` clean.
The `sheetModal` config is parked with a `TODO(paywall)` for the proper fix (make the ScrollView the
first child, then restore the sheet presentation).
- **Leftover P2:** the custom grabber bar at the top is now vestigial on a card — drop it in the proper fix.

## 🗣️ Your flagged items

- **[DISCUSS] Profile → "Your Plan" → App Store manage.** On a premium tier the row calls
  `manageSubscriptions()` (StoreKit) — shows "Cannot Connect" in-sim, the native manage sheet on device —
  *not* the in-app Paywall (`ProfileScreen.tsx:269`). Decision needed: intended, or route premium users to
  an in-app manage/plan screen? (The real Paywall is reached via the "Fix your finances" CTAs.)
- **[TODO · Roast composer] Remove the check-in card** — "🔔 Your June check-in is ready" at the bottom of
  the composer.
- **[TODO · Roast composer] Remove the bottom paywall card** — "✨ Fix your finances…" →
  `navigate('Paywall')` (`RoastComposerScreen.tsx:330`).
  Both confirmed on-device (free tier). Tracked as recommendations — not yet implemented.

---

## 🔁 Cross-cutting findings (fix once → many screens improve)

- **CC-1 [P1] Scroll / safe-area — content slides under the status bar ("the transparent corners").**
  On the Dashboard (and every scroll screen) content scrolls to the very top edge with no opaque safe-area
  mask: the header collides with the status-bar clock and the rounded top corners show through. **Fix:** a
  fixed opaque top inset behind the status bar (or clip the scroll content / a solid header that fades in
  on scroll). Most visible on Dashboard, Community, Results, History. *(This is the issue you called out.)*

- **CC-2 [P1] Bare `TouchableOpacity` → `PressableScale` (pervasive, ~30+).** SubscriptionAudit (6),
  MonthlyCheckIn (6), Share (9), Processing (3), Profile (4), Community (4), Results, DebtPayoff, ActionPlan,
  Settings, EditProfile, FinancialContextForm. No press spring / haptic / reduce-motion. The #1 reuse
  violation by count.

- **CC-3 [P1] Ionicons / MaterialCommunityIcons → Heroicons (doctrine §6).** Largest clusters: Results
  (~20), Settings (~15), Profile, MonthlyCheckIn, DebtPayoff. No per-icon justification. The one genuine
  gap is a snowflake (Snowball strategy) — document that exception.

- **CC-4 [P1] Ad-hoc `` `$${n}` `` → `@/utils/format.ts` (doctrine §10).** SubscriptionAudit (6),
  Results (3+), Paywall (2), MonthlyCheckIn, Share. Add a `formatCompactCurrency` ("$5k") for the Dashboard
  tiles (currently the inline `fmtMoney`).

- **CC-5 [P1] Thin-view — business logic living in screens.** Dashboard (inline SVG sparkline + series math
  + `fmtMoney`), SubscriptionAudit (summary reduces), ActionPlan (`generatePersonalizedSteps` plan-gen
  heuristics + `DEFAULT_STEPS`), Results (50/30/20 budget math + dual-shape `?.value ?? scalar` coalescing),
  Paywall (CTA/entitlement derivation), EditProfile (5 direct `supabase.*` auth calls). → move to `shared/`
  or a service.

- **CC-6 Direct entitlement / data access in screens.**
  - **[P0] Results** calls `getSubscription` + `canAccess` + `getTrialStatus` directly — the *exact named
    anti-pattern* in CLAUDE.md → `useSubscription().hasAccess('action_plan')`.
  - **[P1] EditProfile** makes 5 direct `supabase.rpc` / `supabase.auth.*` calls → a profile/auth service.
  - **[P1] Profile** calls `isSubscriptionPremium(tier)` directly → use the hook's `premium`.

- **CC-7 [P1] `.map()` over growable lists in a `ScrollView` → `FlatList`.** SubscriptionAudit
  (subscriptions), DebtPayoff (debts). (Notifications / Paywall `.map`s are bounded — fine as-is.)

- **CC-8 [P1/P2] Dead code (leave-it-cleaner).** TrendScreen (a whole block of dead `Svg/Circle/Defs/
  GlassCard/LinearGradient/getScoreBand` imports **+** dead `deltaById` / `periodItems` computations —
  reads like a refactor left its scaffolding), ProfileScreen (unused `TextInput` import), SettingsScreen
  (dead `LinearGradient` import), RoastComposer (dead `score*` StyleSheet keys), FinancialContextForm (dead
  `CTX_COLUMNS` export).

- **CC-9 Correctness drifts to verify.**
  - **[P1] Results** `Animated.ScrollView` rests at `opacity:0` until a JS-driven fade — the documented
    blank-screen failure mode. → Reanimated `entering` / start visible.
  - **[P1] Share** captions hardcode `'savage'` tone regardless of the roast's actual tone; `handleCopyLink`
    Alerts "copied" but never writes to the clipboard.
  - **[P1] MonthlyCheckIn** `runReScore` hand-builds the freeText instead of the canonical
    `buildRescoreInput` — divergence risk vs every other re-score path.

- **CC-10 [P2] Repeated literals / UI to extract.** `insets.bottom + 24` (→ `Spacing.xxl`, 4+ screens),
  a 32×32 `IconBadge` (Profile + Settings only — the **Finances/Tools** rows use **bare** Heroicons, no
  tinted `accentContainer` badge; don't re-add one), the `›` chevron glyph. Also `getScoreBand` returns
  **off-palette hexes** (`#FF4D6D`/…) that don't exist in the theme — reconcile `bands.ts` with the tokens.

- **CC-11 [P2] Keyboard handling missing on forms.** EditProfile (password fields can be covered),
  FinancialContext (income input), RoastComposer (`KeyboardAvoidingView behavior="padding"` crop risk).
  → `automaticallyAdjustKeyboardInsets` + `keyboardDismissMode="interactive"` (the LoginScreen fix).

- **CC-12 [P2] Sparse / under-utilized vertical space.** Tools, Notifications, Trend, and the
  SubscriptionAudit empty-state leave the bottom ~half of the screen empty. Either distribute content or
  add a secondary element. **Empty-state alignment is inconsistent:** Scenario Simulator is dead-centered
  while SubscriptionAudit's empty state sits in the upper third → **unify by routing both through the
  shared `EmptyState` primitive** (recommend vertical-centering — reads more intentional).

---

## 📱 Per-screen (visual + top code findings)

**Dashboard** — Strong hero (score ring, "Stable" + delta), clean bento (Trend / Roasts / plan & tools).
P1: scroll/safe-area (CC-1); inline SVG sparkline + `fmtMoney` (CC-5). P2: debt figure colored
`Colors.danger` (semantic misuse — a balance isn't an "alert"); "Roasts" stat at `fontSize:40` (off-scale).

**Notifications** — Clean computed cards (plan-stale, check-in-due). P2: emoji icons vs Heroicons; rows lack
a11y labels; sparse bottom.

**Tools** — Clean tiles, tier pill, Heroicons, services for data (one of the cleaner screens). P2: large
empty area below the 2×2 grid; "Soon" is plain text (use a pill primitive); a couple raw px in `iconBadge`.

**Subscription Audit** — Weakest of the tool set. P1: 6 bare `TouchableOpacity`; a hardcoded-rgba
**neon-cyan** decorative gradient (a *demoted* role); ad-hoc `$` ×6; inline summary math; `.map` in a
ScrollView. Empty state sits high (CC-12). Header reads "Subscriptions" but the tile says "Subscription
Audit" (naming).

**Debt Payoff** — Dense and polished (stat tiles, progress banner, strategy toggle, payment chips, priority
list); strong data layer (`@shared` payoff logic, snapshot service, sticky strategy). P1: hand-rolled
segmented control → `SelectableChip`; Ionicons (flame/snow) without justification; `.map` over debts. P2:
inline `0.15` APR threshold in the view; 🔥/⚠️ emoji as status icons.

**90-Day Action Plan** — Highlight: the "Mapping your 90 days…" journey-map build animation is genuinely
nice; settled plan is dense/polished (40% ring, staleness banner, weekly step). P1: `generatePersonalizedSteps`
plan-gen logic in the view (CC-5); hand-rolled native-driver `Animated` pop; inline `SectionLabel` recipe.
P2: two stacked warning/CTA banners + two full-width gradient buttons feel heavy (gradient discipline);
legacy `LayoutAnimation` off the motion tokens.

**Scenario Simulator (stub)** — Correct, minimal, token-driven; vertically centered. P1: hand-rolls the
empty state → reuse `EmptyState` (and unify alignment, CC-12). Header "Scenarios" vs tile "Scenario
Simulator" (naming).

**Roast composer** — Strong (typing-placeholder caret, tone chips, suggestion chips, voice). P1: `KAV
behavior="padding"` crop risk (CC-11); 2 hand-rolled `Animated` blocks + inline `Easing.out(Easing.cubic)`.
P2: dead `score*` StyleSheet keys. **+ your two removals** (check-in card, bottom paywall card).

**Processing** — Clean count-up loaders ("Calculating your score…" / "Reading your situation…"), good
timeout/abort/retry. P1: 3 bare `TouchableOpacity` re-implementing `NeonButton`/`PressableScale`; raw
`16`/`8`/`520` literals.

**Results** — Excellent: large readable roast hero, score ring + confidence, "#1 thing to fix", gradient
CTA, Share/Post/Track actions, collapsed "full breakdown" (good progressive disclosure), disclaimer. But
the most violation-heavy screen: **[P0]** direct `getSubscription`+`canAccess`+`getTrialStatus` (CC-6);
**[P1]** pervasive Ionicons (CC-3), ad-hoc `$` (CC-4), inline 50/30/20 math (CC-5), `opacity:0`-gated
ScrollView (CC-9). P2: two orange pills adjacent ("Stable" + "Medium"); `roastText fontSize:23` off-scale.

**Share** — Polished share card (neon glow, score hero, roast excerpt, barcode, @handle), format toggle,
platform tiles, 3 witty caption cards. **[Demo P1]** mocked captions say "Scored 55… gave me a 55" while
the card shows **80** — turn mocks off for the Share demo, or make the mock captions derive the real score.
P1: 9 bare `TouchableOpacity`; hardcoded platform/gradient hexes (+ the `color` field is dead); captions
pinned to `'savage'`; `handleCopyLink` doesn't copy (CC-9); spinner instead of skeleton.

**Community** — One of the strongest screens: per-post mini score-rings, band pills, emoji reactions,
"+ Share" FAB; correct FlatList/focus/optimistic patterns. P1: 4 bare `TouchableOpacity` (reaction chips);
inline Reanimated durations (`ZoomIn.duration(180)`…) → tokens. P2: `+100` magic tab-bar clearance (→
`TAB_BAR_HEIGHT`); unclamped username/roast text.

**Profile** — Clean (avatar/handle/tier, stats, current-score card, quick-access). P1: unused `TextInput`
import; 4 bare `TouchableOpacity`; `isSubscriptionPremium` direct (CC-6); Ionicons; hardcoded `#fff`/danger
rgba. P2: 3 success `Alert`s → Toast.

**Edit Profile** — Good OAuth "Managed by Google" lock; correct re-auth flow. P1: **5 direct `supabase.*`
calls** (CC-6) — the clearest architectural violation; ~11 `Alert`s incl. success/validation → Toast/inline;
missing keyboard-inset on a password form (CC-11).

**Financial Context** — Well-organized form (state, income brackets + exact, **birthday — DOB fix
confirmed: "June 14, 2001"**, housing, employment, debt). P2: income **bracket ($6k–$10k) ≠ exact ($5000)**
— pick one source; loader is a spinner not a skeleton; a failed save silently `goBack()`s.

**Settings** — Well-sectioned; correct `Toggle` (not RN Switch) + Alert-confirm on most destructive rows.
P1: ~15 Ionicons (CC-3); dead `LinearGradient` import; bare `TouchableOpacity` rows. P2: Sign Out here has
**no confirm** (Profile's does — inconsistent); string-keyed loading state is fragile.

**Paywall** — Strong design (hero, 3-day note, locked-feature preview, plan picker, comparison table, CTA,
restore, legal) — **now scrollable** (fixed). P1: ad-hoc `$` (CC-4); plan names duplicated vs
`PURCHASE_PRODUCTS`; `✓`/`—` glyphs vs Heroicons; entitlement/CTA logic inline. P2: vestigial grabber;
sub-scale `fontSize:9` badges.

**Monthly Check-In** — Well-built ritual (mood emojis, editable "what's changed", progress deltas w/ green
arrows, streak). P1: 6 bare `TouchableOpacity`; mixed Ionicons/MCI; redundant `enterUp` on a pushed card;
`runReScore` freeText drift (CC-9). **Data:** shows "Capital One Credit Card $4,200→$0" while Debt Payoff
shows "Student loan $9,800" — the known snapshot-merge inconsistency.

**Trend** — Clean bar chart with Year/Month/Week/Day tabs + week nav. P1: large block of **dead imports +
dead computations** (CC-8). P2: very sparse (2 data points + empty bottom, CC-12); bare `TouchableOpacity`
sign-in link.

**All Roasts (History)** — Rich, scannable list (mini rings, deltas, mood, quotes, Plan/Captions tags);
structurally the cleanest (correct FlatList + keyset pagination + states). P2: `marginLeft:60` magic
number; spinner footer where skeletons are the house style; the row delegate uses bare `TouchableOpacity`.

---

## 💪 Working well (keep)

Score-ring hero + bands · bento Dashboard · the ActionPlan "Mapping your 90 days…" build animation ·
Community feed (mini-rings + reactions + FAB) · the Share card · Results roast-as-hero typography · Debt
Payoff information density · disciplined-neon restraint (one accent, semantics demoted) · Reanimated
`enterUp` entrances (no native-driver strand risk) · services-for-data discipline on most screens.

---

## 🧹 Housekeeping

- **Temp edit still active:** `services/subscriptions.ts` `DEV_FORCE_DEEP_DIVE` returns `'free'` (so the
  Paywall + free-tier states stay viewable). **Restore to `'deep_dive'` on your go.**
- **Uncommitted:** `AppNavigator.tsx` (keep — paywall scroll fix), `subscriptions.ts` (revert), this doc.
- **Recommend-only:** nothing else here was implemented.
