# Am I Broke? — Redesign Research Brief

> **Status:** Research phase. No code yet — this brief is for approval before any implementation.
> **Branch:** `redesign`
> **Date:** 2026-06-03
> **Inputs:** competitor screen recordings (Cleo, Cash App) analyzed frame-by-frame + a cited
> web-research pass on motion craft, RN/Expo feasibility, and 2025–26 fintech identity trends.

---

## 0. The goal, made concrete

North star: the app should feel **ALIVE** — premium, choreographed, tactile, opinionated — and
never **vibe-coded** (generic, static, "AI-slop purple-gradient-on-dark").

| Vibe-coded tell | Alive equivalent |
|---|---|
| Three+ neon accents, no single conviction | One precise signature accent, used sparingly |
| Static screens, content just appears | Choreographed entrances, count-ups, reveals |
| No touch feedback | Spring press states + haptics on every interaction |
| Generic purple gradients behind everything | One committed background treatment; gradients earned, not default |
| System-default icons everywhere | A committed icon/illustration system with personality |
| Text-heavy walls | Bento hierarchy: one hero element, supporting cards |

Feasibility tags used throughout: **FREE** (Reanimated 4 / Moti, JS-only, UI-thread) ·
**MODERATE** (Skia / Lottie / Rive / custom) · **EXPENSIVE** (native module / heavy custom).

> Stack lever: Reanimated 4 requires the New Architecture (already enabled here) and runs **all**
> animations on the UI thread — so they hold 60fps even while the JS thread is blocked during an
> AI request. That UI-thread guarantee is the single biggest enabler for "alive" and makes most of
> the catalog below FREE. ([R4 blog](https://swmansion.com/blog/reanimated-4-is-new-but-also-very-familiar-b926dd59aa40))

---

## Part 1 — Competitive teardown (from the recordings)

Analyzed via `tools/contact-sheet.swift` (frame-by-frame, AVFoundation). Timestamps reference the
supplied clips.

### Cleo — the one to beat (direct competitor: AI money app, Gen-Z tone)

**Flow observed:** ~4.5 min of onboarding (clip pt1) → the actual app + chat (clip pt2).

- **Onboarding is long and human, by design (~4.5 min).** Photo-led value-prop carousel ("Request
  up to $250", "Learn to spend better", "Stress less about scores", "Simplify your savings"), a
  money-goal questionnaire (icon cards), an "I'm Cleo AI" explainer, DOB/state, an attribution
  survey ("Where did you hear about Cleo?"), and a bank-link upsell. **They gate the bank link, not
  the signup** — and invest heavily in feeling conversational and personal before asking for money
  access.
- **Core loop = AI chat, not forms.** "Hey you 👋" + the user's **name** + emoji + tappable
  suggestion chips. The personality *is* the product. Personalization is everywhere ("Jason, are
  you ready?").
- **Palette:** warm **maroon/cocoa + cream**, real **diverse photography**, hyper-bold sans
  headlines, pill buttons, bottom-sheet modals. Feature sections each get a distinct **warm pastel
  block** (mint / peach / sky-blue / maroon) — colorful but pointedly **not neon**. (Cleo
  deliberately pivoted to cocoa in 2025 for "trust without the coldness" and uses handmade, ironic
  illustrations to dodge fintech sameness — [case study](https://www.izzoul.com/product-design/cleo-ai).)
- **Splash (pt1, t≈0–2.4s):** launch → the white rounded **"cleo" wordmark fades/scales in on a
  full maroon brand field** (no white flash — the brand color owns the screen instantly) with
  animated "..." dots → **cross-dissolve** into the first card, wordmark rising up. Calm, warm,
  confident — *not* flashy.
- **Paywall:** a feature-comparison table ("Select a plan").

**What to steal:** conversational personalization with the user's name; warmth as differentiation;
brand color owning the launch with no white flash; distinct color-per-section instead of one
gradient; gate the *paid/sensitive* step, deliver value first.
**What to beat:** the onboarding is *very* long — we can deliver our magic moment (roast + score)
faster. And Cleo has **no satisfying numeric score reveal** — our biggest opportunity.

### Cash App — brand/identity reference (not interaction model)

- **Pure black + one electric lime accent.** Giant bold balance numerals ("$0"), enormous negative
  space, extreme minimalism. Maximum confidence, minimum chrome. (Mirrors Robinhood's "neon-on-black
  + custom type" conviction — [Porto Rocha](https://www.portorocha.com/robinhood).)
- **Playful 3D-rendered objects** (chrome blobs, a unicorn, a clover) dropped in as surprise
  delight moments — premium *and* irreverent at once.
- Dense settings lists stay black with green accents; pink/magenta as a secondary chip accent.

**What to steal:** the *discipline* of one accent on a dark field; oversized numerals as the hero;
unexpected 3D/illustrated delight objects to carry irreverence.
**Caution:** Cash App is a *transactional* app — its interaction model (keypad, transfers) is not
ours. Use it for **identity confidence**, not flows.

### The strategic tension

Cleo = **warm, human, conversational**. Cash App = **bold, minimal, high-contrast**. Our current
theme (neon-on-dark) sits near Cash App's energy but **without its discipline** (we use three neon
accents where Cash App uses one). The roast concept could justify either pole — see Part 4.

---

## Part 2 — Motion vocabulary (feasibility-tagged)

Named catalog. Spring params reference Reanimated `withSpring` (defaults `stiffness 100, damping 10,
mass 1`). Timing law (NN/G): most UI transitions **100–500ms** (small elements 200–350ms,
cross-screen 400–500ms); **ease-out entering, ease-in exiting**; entrances slightly longer than
exits; linear "looks unnatural." ([NN/G](https://www.nngroup.com/articles/animation-duration/))

| Pattern | Why it reads as alive | Concrete params | Feasibility |
|---|---|---|---|
| **Spring press states** | Tactile, obeys physics | scale→0.96 on press-in; `stiffness 150, damping 15, overshootClamping` for crisp; drop damping→12 for bounce | **FREE** — Reanimated + Pressable/Gesture Handler |
| **Staggered list entrance** | Cascade = choreography, not a dump | `FadeInDown.delay(i*60)`, 40–80ms stagger, each item 200–350ms | **FREE** — Reanimated layout animations |
| **Number count-up / odometer** | The 0→score climb (our payoff) | ease-out ~1.0–2.0s, `tabular-nums` so digits don't jitter | **FREE** — `use-count-up` or `useDerivedValue` |
| **Skeleton → content morph** | Turns AI wait into perceived progress | shimmer ~1000–1200ms loop; content in 200–300ms ease-out | **FREE** — Reanimated shimmer sweep |
| **Scroll-driven reveals / parallax** | Long Results screen comes alive on scroll | drive opacity/translate off `useAnimatedScrollHandler`; reveal over first ~200–300ms of visibility | **FREE** |
| **Haptic-paired motion** | Feedback lands even with sound off / reduce-motion | fire `expo-haptics` on the animation's completion callback (light=ticks, medium/heavy=reveal) | **FREE** — `expo-haptics` + `runOnJS` |
| **CSS-style declarative transitions** | Cheap "everything animates its state changes" | R4 CSS Transitions API; fire-and-forget; covers ~70–80% of needs | **FREE** — Reanimated 4 CSS API |
| **Confetti / celebration** | Universal reward signal (Duolingo) | 60fps on release w/ object reuse; spawn from point | **MODERATE** — `react-native-fast-confetti` (Skia) |
| **Morphing / stateful icons + mascot** | Stateful icons feel "aware" | Rive state machines (idle/loading/success/react); SF Symbols `bounce`/`pulse`/`scale` | **MODERATE** — Rive (interactive) / `expo-symbols` |
| **Generative/painterly background** | Directly counters the AI-slop static gradient | animated Skia shader, slow multi-second motion so it's ambient | **MODERATE/EXPENSIVE** — RN Skia shaders |
| **Shared-element transition** | Home card morphs into Results; score ring persists | same `sharedTransitionTag` on both screens | **MODERATE** — ⚠️ experimental in R4, **native-stack only (not Tabs)**, behind a flag, not production-ready; safer to hand-roll with measured layout |

---

## Part 3 — The reveal moment (our magic moment: roast + 0–100 score)

Neither Cleo nor Cash App nails a numeric reveal. **This is our highest-leverage "alive"
investment, and it's FREE in Reanimated 4.** It should *intentionally* break the 100–500ms UI norm —
a payoff earns suspense. Recommended choreography:

1. **Anticipation (the wait).** While the AI request runs, show a skeleton/shimmer or a "thinking"
   mascot — never a dead spinner. (Perceived progress matters past ~1s.)
2. **The count-up is the centerpiece.** Animate **0 → score, ease-out, ~1.0–2.0s**, `tabular-nums`.
3. **Couple the ring to the number.** The 0–100 `ScoreRing` arc fills in lockstep — Apple
   fitness-rings model: fill + number are one object, so the value feels *earned*.
4. **Land it.** On the final frame: **haptic impact (medium/heavy) + a tiny spring
   overshoot-and-settle.**
5. **Payoff.** *Then* reveal the roast text (staggered fade-up); conditional **confetti** only for a
   genuinely good score / paid unlock.
6. **Don't over-celebrate a bad score** — the roast covers it; keep reward meaningful.

Total reveal ~2.5–3.5s, long *on purpose*. (Duolingo's playbook: celebrate completion, tune rhythm
over many passes, offer a **share card** to extend the moment outside the app — directly applicable
to our shareable roast/score. [Duolingo](https://blog.duolingo.com/streak-milestone-design-animation/))

---

## Part 4 — Brand direction (you asked: evolve vs rebrand → "research both")

### Audit of the current theme (`src/theme/colors.ts`, "Cinematic Honesty × iOS HIG")

| Token | Value | Verdict |
|---|---|---|
| `background` | `#19101c` purple near-black | ✅ Good — *not* pure black, which the research recommends (pure `#000` causes halation under light text) |
| `primary` / `primarySolid` | `#ecb2ff` / `#bd00ff` electric purple | ⚠️ The exact "AI-slop purple" the research warns against, *as the primary* |
| `secondary` `#00e0ff`, `tertiary` `#e7006e`, `success` `#39FF14` | neon cyan / hot pink / neon green | ❌ **Three+ competing neon accents = no single conviction.** This is the #1 vibe-coded tell |
| 5 neon gradients | `gradientPrimary/Score/Cyan/Danger/Success` | ⚠️ Gradients as default, not earned |
| Type: SpaceGrotesk + Inter | — | ✅ Solid, characterful pairing; keep |
| `display` 72px / `heroLarge` 56px | — | ✅ Already have oversized numerals for the score — lean in |

**Diagnosis:** the *bones* are good (dark-but-not-black bg, big type, an existing ScoreRing) but the
**color system lacks conviction** — too many neons, purple-gradient-as-default. That's exactly what
reads as vibe-coded.

### My recommendation: **Evolve, with a disciplined color reset** (a "soft rebrand")

A full rebrand (new type, logo, identity) is more risk/time than the problem warrants; a pure
evolution that keeps three neons doesn't fix the core issue. The high-leverage middle path:

1. **Commit to ONE signature accent.** Pick a single hero color and demote the rest to small,
   semantic-only roles. The research is unanimous: winning fintech brands "commit to a single
   aesthetic conviction and execute it at every scale" (Cash App lime, Robinhood neon, Cleo cocoa).
2. **Two viable directions to prototype** (decision for you — see Part 9):
   - **(A) Keep the neon energy, but disciplined** — one electric accent (e.g. the purple *or* the
     cyan, not both) on the existing dark field, à la Robinhood/Cash App. Closest to today; fastest.
   - **(B) Pivot warm, à la Cleo** — trade neon for a confident warm signature (cocoa/amber/coral)
     to better carry the *roast* personality with "trust without coldness." Bigger change, strongest
     differentiation from generic fintech.
3. **Gradients become earned, not default** — reserve them for the score ring / hero moments only.
4. **Keep** the type pairing, the dark-not-black background, and the oversized numerals.
5. Add **semantic color rules** (positive/negative/warning/neutral) and a real **numerals
   treatment** (`tabular-nums`).

---

## Part 5 — Signature "alive" moments for Am I Broke?

Prioritized, mapped to our screens:

1. **Score reveal** (Results) — Part 3. *The* signature moment. **FREE.**
2. **Roast delivery** — staggered fade-up of the roast, optionally "typed in" like a chat reply to
   echo Cleo's conversational feel without copying it. **FREE.**
3. **Spending breakdown as a bento grid** — one hero card (score) + supporting cards (categories),
   each animating in on scroll, distinct color-per-category (Cleo's move) instead of one gradient.
   **FREE.**
4. **Branded launch** — our brand color owns the splash instantly (no white flash), logo settle →
   cross-dissolve to Home (Cleo's model). **FREE.**
5. **Spring press + haptics everywhere** — every NeonButton/GlassCard. **FREE.**
6. **AI-wait skeleton/"thinking" state** — turn the analyze latency into perceived progress.
   **FREE.**
7. **A reacting mascot** (stretch / big-bet) — Rive state machine that reacts to the roast verdict
   (smug at a bad score, hyped at a good one). High personality, on-brand for a roast app.
   **MODERATE.**
8. **Living background** (stretch) — a slow Skia shader behind the score instead of a static
   gradient, to kill the AI-slop look at the source. **MODERATE/EXPENSIVE.**

---

## Part 6 — Onboarding / first 60 seconds

Evidence: ~77% of users churn within 3 days; value-in-60s → 3–5× retention; Duolingo defers signup
until after the first lesson and lifted day-1 retention 24% with celebratory step motion.
([RubyroidLabs](https://rubyroidlabs.com/blog/2026/02/ux-onboarding-first-60-seconds/))

For us: **let a new user type their finances and get a roast + score *before* forcing signup.** Keep
setup to 3–5 screens, 2–3 personalization taps to tailor tone, light/fast motion + a celebratory
beat after the reveal. This is the opposite of Cleo's 4.5-min gate — our speed-to-magic-moment is a
competitive edge.

---

## Part 7 — Accessibility & reduce-motion (build in, not after)

- **Reduce Motion is a hard requirement.** Gate every decorative animation behind Reanimated's
  **`useReducedMotion()`** (cleaner than hand-rolling `AccessibilityInfo`). When on: snap the score
  to final + keep the haptic (drop the count-up travel), skip parallax/overshoot, preserve all
  *information*. Never make motion the only channel for important info.
  ([useReducedMotion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/))
- **Contrast (our neon-on-dark risk):** WCAG AA = 4.5:1 normal / 3:1 large text. Highly saturated
  neon on dark visually "vibrates" and fatigues — another reason to pull back to one accent,
  desaturate large fills, and reserve neon for small high-emphasis marks. Audit text tokens
  (`textTertiary #6e5f71`, `textMuted #4a3d4d`) against backgrounds with the WebAIM checker.
- Background already avoids pure black (`#19101c`) — good; keep it.

---

## Part 8 — Implementation priority (when we get to building)

**Quick wins (all FREE, do first):** score reveal count-up + ring sync + haptic → spring press
states everywhere → staggered/scroll reveals on Results → AI-wait skeleton → branded splash →
`useReducedMotion()` gating.
**Then (MODERATE):** confetti on good-score/paid-unlock → color-system reset to one accent →
stateful/animated icons.
**Big bets (MODERATE/EXPENSIVE, scope deliberately):** Rive reacting mascot → Skia living
background. Treat shared-element transitions as experimental.

---

## Part 9 — Decisions (resolved from discussion 2026-06-03)

1. **Brand pole:** prototype **both** — (A) disciplined-neon vs (B) warm pivot — on a vertical
   slice with mocked data, decided empirically (flag-based palette swap, not two full builds).
2. **Mascot:** **deferred to a post-launch phase.** Strongest retention lever in the brief, but
   couples to logo + the chosen brand pole + its own research cycle. Revisit after the pole is set.
3. **Scope:** **vertical slice first** (Onboarding/auth → Home/Dashboard → Analyze → Processing →
   Results) to prove the language, then roll out to the remaining screens.
4. **Reference gap:** a Duolingo/Finch reveal-moment recording would still strengthen Part 3 —
   optional, capture if convenient.

### Decisions added since the brief was written

- **Approach = skin, not skeleton.** Rebuild design system / components / layouts / motion; keep
  navigation, state, services, scoring, schemas untouched (inventory confirms clean decoupling).
- **No Plaid** in this design — deferred to v1.1; the v1 experience is manual-input only, and we do
  **not** even add Plaid-ready hooks now (per Jason). v1.1 headline = "now it tracks your real spend."
- **No pre-signup roast** — the roast *is* the product and (without Plaid) the user does real work
  to earn it; giving it away pre-signup loses the account. Gate it behind signup; make signup itself
  fast + alive; optional no-data teaser before signin.
- **Freemium roast economics** — first roast free, free tier capped, cheap-model routing
  (Groq/Haiku) for free generation, Opus quality + paid depth for subscribers. Leaning a **3-day
  soft trial → strong end-of-trial paywall** over 1-and-done (better subscription attachment).
  Config-driven so the model is a flippable parameter, not a redesign.
- **Iconography** — commit to **one** family; pilot **Heroicons** (free, MIT, uses the already-installed
  `react-native-svg`); Nucleo (paid) is the option if we want a more owned feel for the warm pole.
- **The no-Plaid constraint is a design driver:** the manual **input screen becomes first-class**
  (voice, smart prompts, "describe your month" feel) and we add a light self-aware "based on what
  you told me" honesty cue (on-brand for a roast app; builds trust without overclaiming).

---

## Methodology & reproducing this

- **Clip analysis:** `tools/contact-sheet.swift <video> <outdir> [fps startSec maxSec cols rows thumbW]`
  tiles timestamped frames into grid "contact sheets" via AVFoundation (no ffmpeg). Overview pass at
  0.5–1fps; motion bursts at 8fps over short windows. Frames written to `/tmp/redesign-frames/`.
- **To add a reference** (e.g. Duolingo): drop the recording in `../demo_recordings/`, run
  `contact-sheet.swift` over it, and extend Part 1.
- **Reliability note:** competitor *motion* claims are from direct frame analysis of the supplied
  recordings (high confidence). Trend/feasibility claims are cited inline; see the full source list
  in the background research (authoritative: Apple HIG, NN/G, Reanimated/Expo docs, WebAIM;
  reputable: Callstack, Shopify Eng, Eleken, Porto Rocha; inspiration-only: Dribbble/60fps.design).

---

## Sources (condensed)

**Authoritative:** [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion) ·
[Apple HIG — Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback) ·
[NN/G — Animation duration](https://www.nngroup.com/articles/animation-duration/) ·
[Reanimated withSpring](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/) ·
[Reanimated entering/exiting](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/) ·
[Reanimated useReducedMotion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/) ·
[Reanimated shared-element overview](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/) ·
[R4 blog](https://swmansion.com/blog/reanimated-4-is-new-but-also-very-familiar-b926dd59aa40) ·
[RN AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo) ·
[expo-symbols](https://docs.expo.dev/versions/latest/sdk/symbols/) ·
[Expo icons guide](https://docs.expo.dev/guides/icons/) ·
[WebAIM contrast](https://webaim.org/articles/contrast/) ·
[Duolingo streak animation](https://blog.duolingo.com/streak-milestone-design-animation/)

**Reputable:** [Callstack — Lottie vs Rive](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation) ·
[Shopify — RN Skia](https://shopify.engineering/getting-started-with-react-native-skia) ·
[Shopify — Arrive confetti](https://shopify.engineering/building-arrives-confetti-in-react-native-with-reanimated) ·
[Eleken — fintech design 2026](https://www.eleken.co/blog-posts/modern-fintech-design-guide) ·
[Porto Rocha — Robinhood](https://www.portorocha.com/robinhood) ·
[Fontfabric — 2026 type](https://www.fontfabric.com/blog/10-design-trends-shaping-the-visual-typographic-landscape-in-2026/) ·
[RubyroidLabs — first 60s](https://rubyroidlabs.com/blog/2026/02/ux-onboarding-first-60-seconds/) ·
[WriterDock — bento grids](https://writerdock.in/blog/bento-grids-and-beyond-7-ui-trends-dominating-web-design-2026) ·
[Fivejars — dark mode](https://fivejars.com/insights/dark-mode-ui-9-design-considerations-you-cant-ignore/) ·
Cleo case study — [izzoul](https://www.izzoul.com/product-design/cleo-ai)

**Libraries:** [react-native-fast-confetti](https://github.com/AlirezaHadjar/react-native-fast-confetti) ·
[use-count-up](https://github.com/vydimitrov/use-count-up) ·
[Rive RN](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation) ·
[expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)
