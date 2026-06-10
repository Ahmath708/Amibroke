# Onboarding Phase 2 — "Spill the Beans" (AI-first input)

> **Status: planned, NOT started.** Phase 1 (V2 default + @handle identity + DOB sheet) shipped.
> Phase 2 is the bigger lift — parked behind schema-v2. Account creation stays **first** (no
> anonymous auth, no blur/teaser/gatekeeper — those were dropped). This is "swap the input, reuse
> the rest." Source: the AI-first refactor brief + the review thread (decisions below).

## Intent
Make **free-text** the **primary** way to give financial context — the user types their situation in
plain English and we extract + score it — with the **current bracket form as the secondary** path
("I'd rather just tap buttons"). It costs one `analyze` call per new user; accepted as a bet that the
instant-roast hook lands and converts.

## Settled decisions
- **Keep the 3 Story-act scenes** before the hero (the cold open stays).
- **Reuse `analyze`** — it already returns structured fields **+ score + roast** in one call. No
  separate parse endpoint.
- **Account-first** (current order). No anon auth / no deferred-signup wall.
- Free-text **primary**, bracket form **secondary** (escape hatch).

## Target flow
`Story (3 scenes) → Hero "spill the beans" (primary) | "tap buttons" link (secondary) →`
`[primary] analyze (branded loader) → reveal → adjust-numbers (secondary, re-score) → exit`
`[secondary] → existing Build steps (empty) → reveal → exit`

## Open decisions to lock before building
1. **Flow order — hook-first vs confirm-first.** Lean **hook-first**: run `analyze`, show the
   score/roast reveal ASAP, make "adjust my numbers" a fast secondary action (re-score via
   `buildRescoreInput`). Confirm-first (pre-populate → confirm → reveal) trades the "wow" for
   accuracy. **Decide.**
2. **`analyze → onboarding` field mapping** — `monthlyIncome → incomeBracket/incomeExact`,
   `monthlyExpenses → (living/expenses)`, `debts[] → debtBracket`, `liquidSavings → savingsBracket`,
   `mentionedSpending → suggested subscriptions`. Pin the exact derivations (reuse the `*BracketFor`
   helpers).
3. **Vague-input fallback** — if `analyze` extracts little, land on empty brackets (the secondary
   form) with a nudge, rather than a half-filled confirm.
4. **Cost** — the hero makes the onboarding `analyze` fire for **every** new user → do the
   cheap-model routing (`provider` param on `analyze`, the existing `TODO(cost)`) in the same pass
   (rule #1).

## Building blocks already in place
- `analyze` (free text → structured + score + roast) — the Roast composer path.
- The Build steps + `FinancialContextForm` = the confirmation/secondary UI.
- Snapshot confident-merge (`mergeSnapshot`), `buildRescoreInput` (re-score on edit).
- Branded loaders (`RoastLoading`, `CALC_MESSAGES`), the `BrokeCard` reveal.
- Onboarding is now one consolidated screen (`OnboardingScreen`) — clean to restructure.

## New work
- `OnboardingHeroView` step (the big multiline input + primary CTA + secondary link), inserted after
  the Story act.
- Wire the hero CTA → `analyze` → map → reveal (or confirm, per decision #1).
- The cheap-model routing on `analyze` (decision #4).
