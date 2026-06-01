---
name: audit-screen
description: Design-audit a single app screen against the "Am I Broke?" concept and theme. Invoked as /audit-screen <name> (e.g. /audit-screen home). Grounds findings in theme tokens, screenshots the iPhone SE simulator, checks readability/contrast/hierarchy/consistency, judges whether the screen is too basic, and recommends fixes. Recommend-only — never implements until approved.
---

# Audit Screen

Audit one screen's design and return a prioritized, actionable critique. Invoked as
`/audit-screen <name>` — e.g. `/audit-screen home`, `/audit-screen results`,
`/audit-screen checkin`.

## Owner defaults (decided — do not re-ask each run)

1. **Audit & recommend ONLY.** Produce findings + recommendations and STOP. Implement
   nothing until the user explicitly approves. They like to hash it out conceptually first;
   expect follow-up discussion before any code.
2. **Capture:** assume the **iPhone SE (3rd gen)** sim is already booted **on the target
   screen**. If you can't confirm it's on that screen, ask the user to navigate there before
   screenshotting — don't drive the sim yourself.
3. **Device:** iPhone SE (3rd gen) only — smallest screen, tightest constraints.
4. **Standout ideas:** propose "make it stand out" additions (motion, a hero visual,
   accenting) **only when a screen genuinely feels flat for its importance.** Leave utility
   screens (Settings, legal, FAQ) clean. Not every screen needs flair.

## Step 1 — Locate the screen

Map the arg to `src/screens/<Name>Screen.tsx` (fuzzy: `home`→HomeScreen, `results`→ResultsScreen,
`paywall`→PaywallScreen, `checkin`/`check-in`→MonthlyCheckInScreen, `landing`→LandingScreen).
If the name is ambiguous or missing, list candidates from `src/screens/` and ask. Read the whole
file — note its components, styles, data sources, and navigation.

## Step 2 — Ground every claim in the theme

Read `src/theme/colors.ts` and cite exact tokens (`Colors`, `Typography`, `Spacing`, `Radius`)
and the screen's line numbers. Contrast cheat-sheet on the dark background:

- `textPrimary` `#eeddee` — strong, high contrast. Good for anything important.
- `textSecondary` `#a897ab` — readable but subordinate. Fine for support text.
- `textMuted` `#4a3d4d` — **near-illegible** on the dark bg. Flag any body/label/placeholder
  using it; it's only acceptable for true fine-print.
- `primary`/`tint` `#ecb2ff`, `primarySolid` `#bd00ff` — brand accents; high contrast.
- Glass borders `glassBorder` (0.08) is barely visible; `glassBorderLight` (0.14) reads.

If the screen hardcodes colors/spacing instead of tokens, flag it (CLAUDE.md convention).

## Step 3 — Check consistency with the rest of the app

- Trace any displayed **labels/colors/values** to their source of truth and confirm they match
  sibling screens. Example: score band label + color come from `@shared/scoring/bands`
  (`getScoreBand`) — the exact source the Results screen renders. A screen inventing its own
  labels/colors is an inconsistency to call out.
- Prefer **existing components** (`ScoreRing`, `ScreenBackground`, `NeonButton`, `GlassCard`,
  `AppTextInput`, `AnalyzingHero`) over bespoke UI. Flag reinvented wheels and any text input
  not using `AppTextInput` (which carries the branded `primarySolid` caret).

## Step 4 — Screenshot on the SE

```bash
xcrun simctl io booted screenshot /tmp/audit-<name>-1.png
```
Then Read the PNG. Beyond a single shot:

- **Animated screens:** capture several frames ~1.5–2.5s apart to see motion states and
  transitions (some frames legitimately catch a fade gap — don't mistake it for a bug).
- **Overflow / scrollable screens (EXPECTED for Settings, Results, ActionPlan, History, long
  forms):** the first viewport is not the whole screen. Scroll and capture multiple sections —
  use `scripts/sim-capture.sh <label> <frames>` or idb swipes directly:
  - idb binary: `~/.idb-venv/bin/idb`. SE is **375×667** logical. Swipe up (e.g. y 500→200) to
    scroll down. **Do NOT set `IDB_COMPANION`** (idb manages the companion via `idb connect`).
  - Evaluate the entire scroll, not just the top.
- **Non-scroll screens:** verify everything fits with no clipping. The usual victims pushed off
  the bottom are sign-in links, disclaimers, and CTAs — check they're fully visible.

## Step 5 — Audit dimensions

Lead with the highest-impact issues. For each, cite the token/line and give a concrete fix.

1. **Readability & contrast** — muted text, low-contrast pairs, overall brightness. Is anything
   hard to read? (The `textMuted` trap above is the most common offender.)
2. **Visual hierarchy** — does the eye land on the right element first? Competing headers,
   too many text blocks before the actual content, a weak primary CTA?
3. **Bloat & redundancy** — duplicated copy, lines that repeat adjacent content (e.g. a subhead
   that re-states the value props verbatim), anything cuttable.
4. **Brand & theme consistency** — neon/glass aesthetic, token usage, cross-screen label/color
   parity, component reuse.
5. **Layout fit / overflow** — fits the SE (non-scroll) or scrolls cleanly (scroll). Nothing
   clipped, no jarring height jumps between states.
6. **Accessibility** — touch targets ≥44pt, `numberOfLines` to prevent jumpy wraps, branded
   caret/selection (`selectionColor`/`cursorColor` = `Colors.primarySolid`), legible sizes.
7. **Too basic? / standout (per the policy above)** — only if the screen feels flat for its
   importance, propose 1–2 theme-fitting additions. Reusable building blocks: Reanimated
   (drifting orbs / staggered entrances), `react-native-svg` (rings, self-drawing charts),
   the `AnalyzingHero`/`ScoreRing` motion patterns. Skip entirely for utility screens.

## Step 6 — Deliver, then STOP

- A **prioritized findings list** (highest impact first), each with the fix and the token/line.
- A short **recommended fix-set** at the end.
- Do **not** edit anything. Wait for the user to pick what to implement.

## After approval (only when the user says go)

- Implement the agreed changes (often the user will choose a subset via discussion).
- `npx tsc --noEmit` — the fastest correctness signal in this repo. Run `npm test` if shared/
  logic changed.
- Re-screenshot on the SE to verify (multiple frames for motion/overflow; confirm no new
  clipping). Report what you saw.
- Don't commit or push unless asked. If asked: work on `dev`, and **do not add a
  "Co-Authored-By: Claude" trailer** (owner override).

## Guardrails

- **AI mocks are ON in dev** — an audit must never trigger a real analysis or any paid API call
  (CLAUDE.md rule #1). Screenshotting and reading UI is safe; submitting the analyze flow is not.
- Screen routes live in `src/navigation/AppNavigator.tsx`; types in `src/types`. Components in
  `src/components/`; theme in `src/theme/colors.ts`; cross-runtime logic in `shared/`.
