---
name: audit-screen
description: Design-audit a single app screen (or sweep several) against the Am I Broke? design doctrine (docs/design-doctrine.md). Invoked as /audit-screen <name> (e.g. /audit-screen home) or /audit-screen --sweep <a> <b> … for cross-screen consistency. Screenshots the iPhone SE simulator, grades the doctrine's §13 gate as a rubric, and returns a prioritized, severity-tagged critique with concrete fixes citing tokens + line numbers. Recommend-only — never implements until approved.
---

# Audit Screen

Grade one screen's design against the **design doctrine** ([`docs/design-doctrine.md`](../../../docs/design-doctrine.md))
and return a rubric scorecard + a prioritized, severity-tagged critique with concrete fixes.
Invoked as `/audit-screen <name>` — e.g. `/audit-screen results`, `/audit-screen checkin`. Add
`--sweep <a> <b> …` to compare several screens for cross-screen drift (see **Sweep mode**).

**The doctrine is the single source of truth.** This skill is a *grader*, not a rulebook: cite the
doctrine section a finding violates (e.g. "§10 — ad-hoc `$` formatting, not `format.ts`") rather than
restating rules. The doctrine's **§13 gate is this skill's rubric** — they stay in sync by design.

## Owner defaults (decided — do not re-ask each run)

1. **Audit & recommend ONLY.** Produce findings + STOP. Implement nothing until the user explicitly
   approves; they hash it out conceptually first.
2. **Capture:** assume the **iPhone SE (3rd gen)** sim is booted **on the target screen**. If you
   can't confirm it's on that screen, ask the user to navigate there — don't drive the sim yourself.
3. **Device:** iPhone SE (3rd gen) only — smallest screen, tightest constraints.
4. **Restraint is a rule, not a gap** (doctrine §0/§13.10): propose "make it stand out" additions
   only when a screen feels flat *for its importance*. Leave utility screens (Settings, legal, FAQ)
   calm. Don't ding a clean utility screen for lacking motion.

## Step 1 — Locate the screen

Map the arg to `src/screens/<Name>Screen.tsx` (fuzzy: `home`→HomeScreen, `results`→ResultsScreen,
`paywall`→PaywallScreen, `checkin`/`check-in`→MonthlyCheckInScreen, `edit-profile`→EditProfileScreen,
`notifications`→NotificationsScreen). If ambiguous/missing, list candidates from `src/screens/` and
ask. Read the whole file — note components, styles, data sources, navigation.

## Step 2 — Load the doctrine + tokens (what you grade against)

Read [`docs/design-doctrine.md`](../../../docs/design-doctrine.md) (the spec) and `src/theme/colors.ts`
+ `src/theme/motion.ts` (the exact token names/values). Cite tokens + the screen's line numbers in
every finding. If the screen hardcodes colors/spacing/motion instead of tokens, that's an automatic
finding (§2–5).

**Contrast quick-reference** (verify against `colors.ts` — palette is swappable):

- `textPrimary` `#eeddee` — strong. Anything important.
- `textSecondary` `#a897ab` — readable but subordinate. Support text.
- `textTertiary` `#8a7b8d` / `textMuted` `#7a6b7c` — low-emphasis; both pass **AA-large** but are
  **fine-print only**. Flag any *primary* label/body/placeholder using them.
- `accent` / `accentSolid` — the **one** signature accent (`accent*` family). Flag legacy `primary*`
  aliases and any *second* decorative neon (§1).
- `glassBorderLight` (0.14) reads; `glassBorder` (0.08) is barely visible — fine-print only.

## Step 3 — Screenshot on the SE

```bash
xcrun simctl io booted screenshot /tmp/audit-<name>-1.png
```
Then Read the PNG. Beyond a single shot:

- **Animated screens:** capture several frames ~1.5–2.5s apart to see motion states/transitions
  (some frames legitimately catch a fade gap — don't mistake it for a bug). Judge motion against §5.
- **Scrollable screens** (Settings, Results, ActionPlan, History, long forms): the first viewport
  isn't the whole screen. Scroll + capture multiple sections — `tools/sim-capture.sh <label> <frames>`
  or idb swipes (`~/.idb-venv/bin/idb`, SE is **375×667** logical, swipe y 500→200 to scroll down;
  **don't** set `IDB_COMPANION`). Evaluate the whole scroll, and confirm content **clears the floating
  tab bar** (§11).
- **Non-scroll screens:** verify everything fits with no clipping (usual victims pushed off-bottom:
  sign-in links, disclaimers, CTAs).

## Step 4 — Grade the rubric (= the doctrine §13 gate)

Score each dimension **1–5** (or **N/A**) with a one-line justification. Each maps to a doctrine
section — cite it. Lead with the lowest scores / highest-impact issues.

| # | Dimension (doctrine §) | What to check |
|---|---|---|
| 1 | **Brand & color** (§1–2) | one accent, accent-agnostic, semantics semantic-only, tokens not hardcoded, text-emphasis/contrast ladder |
| 2 | **Spacing & rhythm** (§3) | gaps on the 4/8/12/16/20/24 scale, consistent card padding, grid alignment |
| 3 | **Typography** (§4) | from the type scale, `tabular-nums` on numerics, `numberOfLines` on overflowable text |
| 4 | **Motion & alive** (§5) | `PressableScale`/`CountUp`/`entrances` not hand-rolled, motion tokens not inline literals, **reduce-motion**, the score-reveal not diluted/duplicated |
| 5 | **Icons** (§6) | Heroicons, consistent sizes; flag any `@expo/vector-icons` without a documented reason |
| 6 | **Reuse** (§7) | primitives over bespoke; `getScoreBand` for band label/color; data via services |
| 7 | **Hierarchy & UX** (§8) | bento (one hero + supporting), eye lands right, touch ≥44pt, honesty cue |
| 8 | **Interaction & feedback** (§9) | Toast/Alert/inline channel, disabled/loading states, destructive confirm, sheet-vs-push, keyboard handling |
| 9 | **Content & data** (§10) | money via `format.ts`, degenerate data (zero/large/negative/null), skeleton-not-spinner + empty/error, microcopy/caps/emoji |
| 10 | **A11y & environment** (§11) | Dynamic Type, VoiceOver labels (esp. icon-only), safe-area + tab-bar clearance, status bar |
| 11 | **Performance** (§12) | `FlatList` for long lists, no always-on heavy motion, memo/avoid refetch |
| 12 | **Anti-vibe-code & identity** (§0, §13.10) | run the §0 table pass/fail; ≥1 positive identity anchor present; not too basic for its importance |

Mark **N/A** honestly (a static legal screen has no Motion/Performance surface). Don't pad scores.

## Step 5 — Competitor research (on demand only)

Default to the brief's already-analyzed teardown ([research-brief Part 1](../../../docs/redesign/research-brief.md):
Cleo, Cash App). Only do a **fresh** web pass for a pattern the brief doesn't cover — and say so.
Don't research every run; it's for novel patterns, not routine audits.

## Step 6 — Deliver, then STOP

1. **Scorecard** — the rubric table with each dimension's 1–5/N-A + a one-line note.
2. **Prioritized findings** (highest impact first). Each: **severity** (`must-fix` / `should` /
   `polish`) · doctrine **§** · **token + line** · a concrete **before → after** fix.
3. A short **recommended fix-set** (often a subset worth doing first).
4. Do **not** edit anything. Wait for the user to pick what to implement.

## Sweep mode — `/audit-screen --sweep <a> <b> …`

Cross-screen drift is where vibe-code creeps in. Screenshot each named screen, then compare them on
the consistency-sensitive dimensions: **spacing rhythm, icon family/sizes, money formatting, motion
patterns, feedback channel (Toast/Alert), component reuse, header pattern**. Output a small matrix
(screen × dimension) flagging divergences, and recommend the **canonical** choice for each (citing
the doctrine section). Same recommend-only rule — STOP after.

## After approval (only when the user says go)

- Implement the agreed changes (often a discussed subset). **Follow the doctrine** — it's the
  standing rule for all UI work.
- `npx tsc --noEmit` (fastest correctness signal here); `npm test` if `shared/` logic changed.
- Re-screenshot on the SE to verify (multiple frames for motion/overflow; confirm no new clipping,
  content clears the tab bar). Report what you saw.
- Don't commit or push unless asked; follow the repo's commit conventions (CLAUDE.md).

## Guardrails

- **AI mocks are ON in dev** — an audit must never trigger a real analysis or any paid API call
  (CLAUDE.md rule #1). Screenshotting + reading UI is safe; submitting the analyze flow is not.
- Doctrine: `docs/design-doctrine.md` · routes: `src/navigation/AppNavigator.tsx` · types:
  `src/types` · components: `src/components/` · theme: `src/theme/` · cross-runtime: `shared/`.
