# Planned UI Improvements

A running log of UI/UX changes we want to make, captured as numbered **Plans**. These are
**planning-only** entries — we are *not* implementing them yet (another Claude session is actively
working on the app). Each plan should be detailed enough to hand off and build later without
re-deriving the reasoning.

Reference clips that inspire a plan live in the gitignored [`tmp/`](../tmp/) folder, named after the
screen/flow they focus on (e.g. `onboarding-*.mp4`).

---

## Plan 1 — Navbar reframe: `+` action menu, drop the Roast & Tools tabs, add a Money tab

**Status:** Planned (not started — blocked on the other active session). Build behind a `FEATURES`
flag on a throwaway branch so it's trivially reversible.

**Inspiration:** A 7-second clip of the **Bevel** health/biology tracker
(`spottedinprod.com/clips/694`, local copy was `~/Downloads/2026-06-09 11-32-17.mp4`). Bevel shares
our core loop shape: *user inputs data → AI returns a verdict*.

### What Bevel actually does (observed from the clip frames)

- It is **not** a centered FAB. Four tabs (Home · Journal · Fitness · Biology) live in one floating
  capsule, and the **`+` is a separate circular button docked to the right** of that capsule. The
  active-tab pill slides across the 4 tabs; the `+` sits outside it.
- Tapping `+` **raises a 3×3 grid sheet** from the bottom, frosting/blurring the screen behind it,
  while the tab bar stays put and the **`+` morphs into an `×`** in place.
- The 9 cells are all *"add data" verbs + AI actions*: Describe food, Import food, Capture food /
  Scan food, **Ask Bevel** (dead-center, glowing AI hero cell), Search food / Generate templates,
  View templates, Log activity.
- The **center cell is reserved for the marquee AI action** ("Ask Bevel"); everything around it is
  input/logging.

### Why it maps onto "Am I Broke?" almost 1:1

Our loop is identical: *type/speak finances → AI roast*. The center-hero convention is a gift —
"Ask Bevel" → **"Roast Me."** Pulling Roast out of the tab bar is justified because Roast is an
*action*, not a *place*, and the menu's hero slot is purpose-built for exactly one marquee action.
This also kills the awkward dual-identity of `HomeScreen` (currently both the `Roast` tab via
`asTab` **and** the pushed `Analyze`/"New Roast" route).

We already own most of the primitives: `IOSTabBar` is the floating capsule, `Fab.tsx` is the
detached round button. The only net-new piece is the menu sheet (rising layout + blurred backdrop +
the `+`↔`×` morph), built against motion tokens / `PressableScale` / Heroicons / `useReducedMotion`
per [`docs/design-doctrine.md`](design-doctrine.md).

### Target navigation

```
 ┌─────────────────────────────────┐   ╭───╮
 │ Home   Money   Community  Profile │   │ + │
 └─────────────────────────────────┘   ╰───╯
```

- **4 dwell tabs in the capsule:** Home · Money · Community · Profile.
- **Detached `+`** docked right → opens the action sheet (below).
- **Roast leaves the tab bar** → becomes the hero action in the sheet.
- **Tools tab → "Money" tab.** The Money tab gives *direct access to the financial snapshot* (the
  `financial_snapshots` source-of-truth), and the gated tools (Subscription Audit, Debt Payoff,
  90-Day Plan, Scenario Simulator) live *inside* it. Those are **destinations**, not actions, so
  they belong in a tab — not the `+` menu.

Net: both the **Roast tab and the Tools tab go away**; the financial context gets a real home.

### The `+` action sheet — hero-row layout (NOT a symmetric grid)

The sheet holds **only genuine actions** (the user gives input or requests a verdict). We resisted
padding it to fill a grid. The honest set is four actions:

- **Roast Me** — type/speak finances → full roast. The hero.
- **Update my finances** — edit the snapshot directly, no roast.
- **Monthly check-in** — the soft-monthly ritual.
- **Re-score** — recompute the score from the existing snapshot, no re-typing (already wired via
  `useRescore` / `buildRescoreInput`; paywall-gated, which reinforces the paywall surface).

**Why not a 2×2 grid:** a symmetric 2×2 has four equal quadrants and **no privileged center**, so
"Roast Me" would demote to one-of-four — losing the hero elevation that Bevel's odd 3×3 center cell
provides. Since pulling Roast out of the tab bar is already a discoverability bet (Roast is our
growth loop), we crown it by **visual weight**, not grid position. Use a **hero-row layout**:

```
   ╭─────────────────────────────╮
   │   🔥   Roast Me              │   ← full-width hero tile (accent fill)
   ╰─────────────────────────────╯
   ┌────────┐ ┌────────┐ ┌────────┐
   │ Update │ │Check-in│ │Re-score│   ← 3 equal secondary actions
   └────────┘ └────────┘ └────────┘
```

This sidesteps the even/odd-columns problem entirely and gives Roast *more* weight than a center
grid cell would. The sheet grows only when a real action earns a slot.

**Explicitly excluded from the sheet:**
- **Captions** — a *contextual* action that only exists once a roast exists. It lives in the
  Results share sheet, not a global create-menu (surfacing it here would offer it with nothing to
  caption).
- **Debt Payoff / Scenario Simulator** — destinations, not actions → Money tab.

**Possible future cells (net-new features, not built today — add only when real):**
- **Set a goal** — a savings/payoff target the score and plan track against.
- **Ask AB** — conversational "can I afford X?" Q&A (the direct analog of "Ask Bevel"; overlaps
  with Scenario Simulator's what-if territory, so pick one).

### Build approach (when unblocked)

1. Flag-gate the whole reframe in `src/config/features.ts` so the live 5-tab bar is the default and
   the new nav is opt-in for the prototype.
2. Reuse `IOSTabBar` for the 4-tab capsule (the sliding pill still works across 4 tabs) and `Fab.tsx`
   as the detached `+` button; animate `+`↔`×`.
3. Build the action sheet: rising hero-row layout, blurred backdrop scrim, `PressableScale` cells,
   motion via `theme/motion.ts` tokens, `useReducedMotion` variant, Heroicons.
4. Collapse `HomeScreen`'s `asTab` dual-identity — Roast is reached only via the sheet's hero tile
   (keep the Dashboard empty-hero CTA too, to hedge the discoverability bet).
5. Reparent the Tools grid into the new **Money** tab alongside the snapshot view.

### Caveats / open risks

- **Discoverability bet:** demoting Roast from a tab to a menu cell risks fewer roast starts.
  Mitigations: glowing full-width hero tile + keep the Dashboard empty-hero CTA. Feel it on a real
  device before committing.
- **iOS grain:** a docked `+` action button is slightly more Material than HIG, but plenty of top
  iOS apps do it — a deliberate deviation, not a blocker.
- **Paywall:** most sheet actions are gated; gated cells should route to the Paywall gracefully, not
  dead-end.

---

## Plan 2 — Onboarding rebuild: Story → Build → Payoff (narrative cold-open + live score + Broke Card)

**Status:** Planned (not started — blocked on the other active session). This is a **ground-up
rebuild** of `OnboardingScreen.tsx` (explicitly acceptable). Flag-gate behind `FEATURES` so the
current flow stays default until the new one is ready.

**Inspiration:** Six onboarding clips in [`tmp/`](../tmp/) (`onboarding-1`…`onboarding-6.mp4`):
1. **Introspect** (spend control) — *narrative cold-open*: a 5-beat editorial story sells the "why"
   before any input (world-engineered-to-make-you-buy → the Office *same-picture* meme → "build a
   filter") → an **interactive Buy It / Let It Go toggle with live consequence numbers** → **"What
   should we print on your cards?"** printing the user's name live on a branded card. White→green
   color journey, continuous progress bar.
2. Trivia/puzzle — *content montage as proof* (grid of real colorful tiles), a "how did you hear
   about us?" step, a share/invite beat.
3. Weather — *auto-advancing value carousel + pinned paywall* (top half cycles on its own, bottom
   half is a fixed Start-Trial CTA).
4. **Cusp** (subs tracker) — *mascot + trust*: a recurring character, real logos orbiting it with
   PAID/EXPIRED pills, explicit trust badges, custom flat illustrations per screen.
5. Caffeine tracker — *personality in micro-interactions*: live cheeky feedback ("0 mg — you've had
   literally nothing"), themed emoji progress stages, a scrubber/ruler picker, custom CTA labels
   ("About Right", "Lights Out, Baby"), mesh-gradient bg, colored keyword underlines.
6. Travel planner — *animated metaphor illustrations* (envelopes flying into an envelope; a
   category-icon timeline).

**Cross-cutting lessons:** (1) every screen has a hero visual — nobody ships bare forms; (2) the
best flows tell an emotional story before asking for data; (3) they create a live, interactive proof
moment; (4) they hand you a personalized artifact; (5) personality lives in the micro-copy and
pickers, not just the headline.

### The problem with today's onboarding

`OnboardingScreen.tsx` is five **bare form steps** (names → demographics → housing/employment →
income → debt/savings) with exactly **one** earned visual — the `ScoreRing` reveal at the very end.
The entire "why" and all the personality our roast voice could carry are visually absent. It reads
like any finance form; it doesn't feel like "Am I Broke?". This is the "lacks the key winning factor
of visuals" gap.

### Target: a three-act flow — Story → Build → Payoff

All of it adapted into **disciplined-neon** (dark field, one `accent*`, Heroicons-first, token
motion, `useReducedMotion`) — we translate these light/cream references into neon-on-void, never copy
their palettes. The roast voice (`profiles.preferred_tone`) is the connective tissue across all three
acts — free leverage we already have.

**Act 1 — Story (narrative cold-open).** 3–4 passive screens *before* any question, selling the
emotional why, then flowing into the data steps.
- Arc: "Your bank app shows balances. It hides the truth." → "We turn your money into one number,
  0–100." → "And we don't sugarcoat it." → *(into questions)*.
- Visuals: a **ghosted `ScoreRing` pulsing in the void** (reuse the asset we own) referenced
  throughout; a neon line-art phone whose green "balance" peels away to red debt underneath; an
  intensity ramp where the accent glow *builds* screen to screen (void → bloom).
- **Auto-advance is allowed here** (mirrors the weather clip) with a pinned "Skip / Continue". Data
  steps in Act 2 stay manual — never auto-advance an input.

**Act 2 — Build (live score tease through the questions).** Keep a **persistent, ghosted
`ScoreRing` pinned at the top** that visibly moves an estimate with every answer — the
interactive-proof beat, built almost entirely from assets we already own (`ScoreRing`, `CountUp`,
the reveal particle burst). Reuses the same five inputs/brackets we collect today (no schema change —
still seeds the snapshot via `seedSnapshotFromOnboarding` + `buildRescoreInput`).
- Per-input neon glyphs: income = an up-arc of coins; debt = an anchor/weight dragging the ring
  down; savings = a shield/cushion; housing = a roof line. Small, animated, Heroicon-flavored.
- Live reactive roast micro-copy per input ("$0 saved? Bold."), themed coin-fill progress (replaces
  the flat 5-segment bar), scrubber pickers + custom CTA labels per step.

**Act 3 — Payoff (mint the Broke Card).** At the reveal, **mint a personalized neon "Financial
ID"** — a credit-card/trading-card object printing the user's name, their score, their band title
(cheeky: *"Certified: Cooked"*), and date.
- Custom visual: a designed card — neon foil gradient, a holographic sheen sweep (animated
  gradient), chip/barcode motif — with a **print/flip reveal**. The score lock-in keeps the existing
  `ScoreRing` solidify + glow bloom + heavy haptic.
- Compounding value: the card doubles as the **shareable artifact** and slots into our existing
  share/captions feature — ownership + virality in one asset.

The net transformation: from "five forms then a number" to **watch-your-own-verdict-assemble** — a
story that earns the data, a score you watch yourself build, and an artifact you want to share.

### Producing the visuals

- **Reuse + Reanimated/SVG** (cheapest, most on-brand) for everything score-centric — we already do
  this in `ScoreRing.tsx`.
- **Rive** for the interactive/reactive pieces (the live-reacting score gauge; optionally a mascot
  with band-based expressions via state machines) — purpose-built for "reacts to input."
- **Lottie** for one-shot hero animations (the balance-peel, the card print).
- **Apple 3D emoji** (free, what Introspect uses) or AI-generated neon hero renders for incidental
  objects.

### Optional layer — Direction D (Voice & character)

A *layer* over Acts 1–3, not a standalone flow: roast-voice live micro-copy on every input, themed
progress, scrubber pickers, custom CTA labels, and possibly a small deadpan mascot (a neon piggy
bank / gremlin) that emotes by band (4 expressions via Rive). Add if it earns its keep; the flow
stands without it.

### Build approach (when unblocked)

1. Flag-gate the new flow in `src/config/features.ts`; keep the current `OnboardingScreen` as
   default until parity + polish.
2. Build Act 1 as a small auto-advancing narrative carousel (passive, pinned CTA, reduced-motion
   variant snaps).
3. Refactor the existing 5 steps into Act 2 with the pinned live `ScoreRing` + per-input glyphs —
   **keep the data model identical** (same `ctx_*` brackets, `seedSnapshotFromOnboarding`,
   `buildRescoreInput` score-only path, `mergeSnapshot`).
4. Build the Broke Card component for Act 3; wire it into the reveal and the share/captions path.
5. Apply Direction D voice/personality pass; delete the now-dead flat progress bar + bare-form
   styles.

### Caveats / open risks

- **Scope:** this is the largest plan here — a full rebuild plus several net-new custom assets
  (neon glyph set, Broke Card, optional mascot). Sequence it Act-by-Act behind the flag; ship Act 2
  (live score) first since it reuses the most and carries the most conversion lift.
- **Cost:** the starting-score still makes one LLM call (`analyzeFinances`, score-only). The
  existing `TODO(cost)` cheap-model routing (`provider` param on analyze) becomes more worthwhile if
  Act 2 ever recomputes mid-flow — keep Act 2's "live estimate" **client-side/heuristic**, not a
  per-keystroke API call (rule #1).
- **Asset pipeline:** Rive/Lottie add a dependency + a design-production loop; confirm the
  bundle-size and New-Architecture compatibility before committing to a runtime.
- **Reduced-motion:** every act needs a `useReducedMotion` path (auto-advance pauses, ring snaps,
  card print becomes a fade) per the design doctrine.

---

<!--
  Add the next plan below as "## Plan 3 — <title>". Keep the same structure:
  Status / Inspiration (+ clip name in tmp/) / observed pattern / mapping / target / layout /
  build approach / caveats.
-->
