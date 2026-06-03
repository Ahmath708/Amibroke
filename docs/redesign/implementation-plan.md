# Am I Broke? — Redesign Implementation Plan

> **Companion to** [`research-brief.md`](./research-brief.md). Read that first for the *why*.
> **Branch:** `redesign` · **Date:** 2026-06-03 · **Status:** awaiting approval — no code written yet.
> **Grounded in** a full inventory of the current frontend (see file refs throughout).

---

## Guiding principles

1. **Skin, not skeleton.** We rebuild the design system, components, layouts, and motion. We do
   **not** touch navigation, `AuthContext`, services (IAP/Supabase/analytics), hooks, the scoring
   engine, or Zod schemas. The inventory confirms these are cleanly decoupled from presentation.
2. **No Plaid** anywhere in this design — purely the current manual-input experience.
3. **One conviction.** Collapse the three competing neons to a single signature accent (the core
   "vibe-coded" fix). Everything flows from tokens.
4. **Motion is built in, not bolted on**, and every decorative animation is gated behind
   `useReducedMotion()`.
5. **Vertical slice first** (Onboarding/auth → Home/Dashboard → Analyze → Processing → Results) to
   prove the language before touching all ~25 screens.
6. **A/B the brand pole** (neon vs warm) cheaply, on the slice, with mocked data.

What we **keep as-is** (per inventory salvage assessment): the SpaceGrotesk+Inter type pairing, the
dark-not-pure-black background, the `ScoreRing` concept, the oversized numeral scale, the
`utils/haptics.ts` wrapper (already settings-gated), navigation, and all business logic.

---

## The central architectural problem: make tokens swappable

Today `src/theme/colors.ts` exports a **flat `Colors` object** that components import directly, and
[`ScreenBackground.tsx`](../../src/components/ScreenBackground.tsx) + `AuthBackground.tsx` **hardcode
~185 color values** outside the token system. To A/B two brand poles we need one themeable source of
truth.

**Approach (cheapest that works): flag-selected palette modules.**
- Refactor `colors.ts` so the palette is one of two modules — `theme/palettes/neon.ts` (disciplined
  evolution of today) and `theme/palettes/warm.ts` (Cleo-like pivot) — sharing one **`Palette` TS
  type** so they can't drift structurally.
- A dev flag (`EXPO_PUBLIC_THEME=neon|warm`, read in `config/`) selects which palette `colors.ts`
  re-exports. `Colors`, `Typography`, etc. keep their current import sites unchanged → **no
  consumer refactor needed**. Switching pole = change the flag + reload.
- **Externalize the backgrounds:** move `ScreenBackground`'s 18 variant objects and
  `AuthBackground`'s colors into a new `src/theme/screenVariants.ts`, keyed off the active palette.
  This is the single biggest refactor in the plan and unblocks both A/B *and* reskinning.

**Optional upgrade (only if you want a live in-app toggle):** a `ThemeProvider` + `useTheme()`
context so you can flip neon↔warm without reload. More work (every themed component consumes the
hook); deferred unless the flag approach proves too clunky for comparison.

---

## Phase 0 — Foundation (no visible change yet)

**0a. Theming**
- Create `Palette` type + `theme/palettes/neon.ts` and `warm.ts`; rewire `colors.ts` to select via
  flag.
- Extract `src/theme/screenVariants.ts` from `ScreenBackground.tsx` / `AuthBackground.tsx`.
- Add semantic color rules (positive/negative/warning/neutral) + a `tabular-nums` numeral style.

**0b. Motion system**
- `src/theme/motion.ts` — duration/easing/spring tokens (entering ease-out 200–350ms small /
  400–500ms large; spring `stiffness 150, damping 15` for crisp press).
- `src/components/motion/` helpers, all Reanimated 4 (already installed @4.2.1):
  - `useReduceMotion()` re-export + a `motionSafe()` helper that no-ops travel when reduce-motion is on.
  - `PressableScale` — spring scale-to-0.96 press + haptic (wraps the existing haptics util).
  - `Entrance` / `staggerDelay(i)` — standardized `FadeInUp.delay(i*60)` entrances.
  - `<CountUp value>` — Reanimated number, `tabular-nums`, ease-out, optional completion haptic.

**Acceptance:** `npx tsc --noEmit` clean; app builds and looks identical (flag=neon defaults to
today's look); flag=warm builds without crashing. No regressions in the sim.

---

## Phase 1 — Reskin the core primitives

The ~9 primitives every screen depends on, restyled against the new tokens + motion system. Files
(from inventory):
- [`NeonButton.tsx`](../../src/components/NeonButton.tsx) (192L) — adopt `PressableScale`; remove the
  hardcoded white label + disabled gradient → tokens. (Likely rename later once "neon" may not be
  the pole — keep the name for now to avoid churn.)
- [`GlassCard.tsx`](../../src/components/GlassCard.tsx) — glassmorphism 2.0 pass (subtle translucency
  + border, not heavy blur everywhere).
- [`ScoreRing.tsx`](../../src/components/ScoreRing.tsx) — **migrate arc from built-in `Animated` →
  Reanimated**; prep for the magic-moment count-up coupling (Phase 2).
- `SelectableChip.tsx`, `StatusPill.tsx`, `TierPill.tsx`, `SectionLabel.tsx`, `AppTextInput.tsx`,
  `ConfidenceBadge.tsx`.
- Composed: `CheckinCard.tsx`, `PremiumCard.tsx` — convert hardcoded gradients → tokens.

**Acceptance:** `tsc` clean; `tools/sim-capture.sh` of a primitives-heavy screen; visual parity in
neon, plausible in warm.

---

## Phase 2 — The magic moment (highest-leverage "alive" win)

The roast + 0–100 score reveal, spanning [`ProcessingScreen.tsx`](../../src/screens/ProcessingScreen.tsx)
→ [`ResultsScreen.tsx`](../../src/screens/ResultsScreen.tsx) + `ScoreRing`. Implements brief Part 3:

1. **Wait** (Processing) — keep the existing step indicator but ensure it reads as *perceived
   progress*, not a dead spinner (skeleton/"thinking" treatment).
2. **Count-up** — `<CountUp>` 0→score, ease-out ~1.0–2.0s, `tabular-nums`.
3. **Ring sync** — `ScoreRing` arc fills in lockstep with the count-up (one object).
4. **Land it** — medium/heavy haptic + tiny spring overshoot on the final frame.
5. **Payoff** — roast text staggers in (fade-up); conditional confetti only on a genuinely good
   score / paid unlock.
6. **Reduce-motion path** — snap to final value + keep the haptic; drop the travel.

> Confetti needs a new dep (`react-native-fast-confetti`, Skia-based) — flag this as the one
> MODERATE add in the slice, or stub it for now and add post-A/B.

**Acceptance:** `tools/sim-record.sh results 8` to review the reveal frame-by-frame; reduce-motion
variant verified; `/audit-screen results`.

---

## Phase 3 — Vertical-slice screen layouts

Re-skin + re-lay-out the slice, applying bento hierarchy (one hero element + supporting cards) and
the motion vocabulary. Files (from inventory):
- **Landing / Login** — [`LandingScreen.tsx`], [`LoginScreen.tsx`] (321L), `AuthBackground.tsx`.
  Branded launch: brand color owns the splash, no white flash, cross-dissolve in.
- **Onboarding** — [`OnboardingScreen.tsx`] + `FinancialContextForm.tsx`. Keep it 3–5 screens, fast,
  with light celebratory motion. **Gate the roast behind signup** (no pre-signup roast).
- **Home (Dashboard)** — [`DashboardScreen.tsx`](../../src/screens/DashboardScreen.tsx) (297L) —
  bento layout: hero score + trend + check-in/upsell cards, staggered entrance + scroll reveals.
- **Analyze ("New Roast")** — [`HomeScreen.tsx`](../../src/screens/HomeScreen.tsx) (427L) — **treat
  the input as a first-class, good-feeling screen** (our no-Plaid edge): refine voice input, smart
  prompts, the "describe your month" feel; add a light self-aware "based on what you told me" cue.
- **Results** — Phase 2 moment + bento breakdown (distinct color-per-category instead of one
  gradient), scroll reveals, share/save CTAs.

**Acceptance:** `tsc` clean; `/audit-screen` on dashboard / home / results; sim screenshots in both
palettes; AI mocks ON (`config/ai.ts`) so no API spend (rule #1).

---

## Phase 4 — Iconography pilot

Pilot **Heroicons** (free, MIT, drops into the existing `react-native-svg` — no new dep) across the
slice; compare against today's Ionicons. Commit to **one family** app-wide; clean up the stray
`MaterialCommunityIcons` usage. (Nucleo = paid option if we want a more *owned* feel, esp. for the
warm pole — export SVG → react-native-svg.)

**Acceptance:** slice renders with a single consistent icon family; visual review.

---

## Phase 5 — A/B the brand pole (neon vs warm)

- Finalize `neon.ts` (disciplined: one accent on dark, à la Robinhood/Cash App) and `warm.ts`
  (cocoa/coral pivot, à la Cleo).
- Capture both on the slice with mocked data: `EXPO_PUBLIC_THEME=neon npm run ios:sim` → record with
  `tools/sim-record.sh`, repeat for `warm`. Produce a side-by-side for the decision.
- **Decide.** Escalate to two branches (`redesign-neon` / `redesign-warm` off `redesign`) **only if**
  the poles diverge structurally (different layouts/motion) — for a pure palette/identity split the
  flag is enough.

**Acceptance:** a recorded side-by-side of the slice in both poles; a documented decision.

---

## Phase 6 — Roll-out + cleanup (post-decision, post-approval)

Apply the chosen language to the remaining ~20 screens; consolidate stray built-in `Animated` onto
Reanimated where it matters; finalize the paywall / trial-end / "used your free roast" upgrade
moments as **config-driven** surfaces (so 1-and-done vs 3-day soft trial stays a parameter, and
freemium cap + cheap-model routing can be tuned without redesign).

---

## Verification strategy (every phase)

- `npx tsc --noEmit` — fastest correctness signal (CLAUDE.md).
- `npm run ios:sim` (the SE sim; **not** `expo run:ios` — signing gotcha).
- `tools/sim-capture.sh` (long screens) / `tools/sim-record.sh` (motion) for review.
- `/audit-screen <name>` on each slice screen.
- A reduce-motion pass on anything animated.
- AI mocks stay ON; no paid API calls without confirmation (rule #1).

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `ScreenBackground` 18-variant refactor is the biggest single task | Do it first in Phase 0; it unblocks everything else |
| Mixed built-in `Animated` + Reanimated | Migrate only the magic moment now; consolidate the rest in Phase 6 |
| Confetti needs a new dep (Skia) | Stub it; add `react-native-fast-confetti` only if we want it in the slice |
| A/B doubling work | Flag-based palette swap (not two full builds); branches only on structural divergence |
| Free-tier Supabase / data | Slice runs on mocked data + `__fixtures__`; no backend changes |
| `NeonButton`/"neon" naming may mislead if we pick warm | Defer renames to Phase 6 to avoid churn during the experiment |

---

## Decisions locked (resolved from discussion)

- **Plaid → v1.1**, not considered in this design at all (manual-input experience only).
- **Roast gated behind signup** (no pre-signup payoff); signup itself made fast + alive; optional
  no-data teaser before signin.
- **Freemium roast**: first roast free, free tier capped, cheap-model routing (Groq/Haiku) for free
  generation, Opus quality + depth for paid. Leaning **3-day soft trial → strong end-of-trial
  paywall** over 1-and-done (better subscription attachment); config-driven so it's flippable.
- **Mascot → Phase 2 of the product** (post-launch); couples to logo + chosen brand pole.
- **Iconography**: commit to one family; pilot Heroicons (free, uses existing svg).
- **Skin not skeleton**; **vertical slice first**; **A/B via flag, branches only if divergent**.

---

## Open question before we build

**Which palette do we author first as the working default for the slice — `neon` (fast, evolves
today's look) or `warm` (the bigger pivot)?** I'd build the slice in one, then fork the palette for
the other in Phase 5. Recommendation: build in **neon** first (less initial risk, reuses more of the
current look), then author `warm` as the contrast — but if you're leaning warm, we start there.
