# Claude Redesign — Backend Follow-ups (2026-06-15)

Surfaced while writing the onboarding-redesign Claude Design briefs (screen-by-screen into a single
`Onboarding.html` flow shell). These are **backend / data-layer** gaps the redesigned onboarding
*implies* but that aren't built yet. The visual/prototype work is happening in Claude Design; this
doc tracks the implementation work to close before the redesigned onboarding ships.

Status: 🔵 = user is handling · 🔴 = must revisit before launch

---

## 1. Capture $0 ("None") income — 🟢 backend landed (2026-06-16) · frontend wiring remains

The redesigned income screen (numpad-default + "Not sure? Pick a range →") includes a **"None" / $0**
option (unemployed, no benefits) — matching debt/savings, and required for numpad parity (the keypad
already lets you type `0`). Per the template's None handling: the sheet reads **"None"**, the giant
display shows **"$0"**.

**The gap:** `patchFromOnboarding` only writes exact income when `exactIncome > 0`
(`shared/financialSnapshot.ts:227`). So a `$0` income (typed or picked) falls through the guard and
is never stored as `$0` — it gets ignored or bucketed to the "Under $2k" midpoint (~$1k), which
*overstates* income for exactly the most financially fragile users.

**Fix:** accept exact `0` → `monthlyIncome: { value: 0, confidence: 'stated' }` (plus the onboarding
wiring to pass `0` when "None"/`$0` is chosen).

**✅ Backend landed (2026-06-16).** `patchFromOnboarding` now accepts a finite, non-negative exact
(`>= 0`, incl. an explicit `0`) and writes it `stated` (`shared/financialSnapshot.ts`). Dormant +
zero-regression: `parseIncome` still returns `null` for `"0"`/empty (`FinancialContextForm.tsx:30`),
so current callers pass `null` → bracket path, unchanged. **Frontend remaining (next session):** the
"None"/`$0` option must pass `0` (and `parseIncome` — or a dedicated $0 signal — must stop dropping it).

**Verified NOT needed (2026-06-15):**
- **`analyze/prompt.ts` — no change.** The score is computed from the CFPB questionnaire lookup table
  (`shared/scoring/cfpb_irt.ts`), which has **no income denominator** — `$0` income can't div-by-zero
  or distort it. The prompt already extracts `$0` fields cleanly (its worked example emits
  `liquidSavings: { value: 0 }`), and `buildRescoreInput` already sends `"about $0/mo income"` as
  free text (`src/services/financialSnapshot.ts:48,61`). A genuinely $0-income user correctly scores
  low — desired behavior.
- **Derived ratios — already guarded.** `savingsRate` / `debtToIncome` use `income > 0 ? … : 0`
  (`shared/calculations.ts:104,108` and `shared/financialSnapshot.ts:103,106`). No NaN/Infinity.

So $0 income is a pure **client-capture** fix — nothing server/LLM-side.

---

## 2. Allow exact numbers for debt + savings (not just brackets) — 🟢 backend landed (2026-06-16) · frontend wiring remains

The redesigned **debt and savings** screens are **numpad-default** — the user can type an exact
amount. But onboarding's snapshot seed only has an exact path for **income**; debt and savings are
**bracket-only** today (`estimated` confidence, midpoint via `DEBT_MID` / `SAVINGS_MID`) — see
`patchFromOnboarding` (`shared/financialSnapshot.ts:222-241`), which accepts only `exactIncome`.

**Fix:** extend `patchFromOnboarding` (+ `seedSnapshotFromOnboarding` + the onboarding screen wiring)
to accept `exactDebt` / `exactSavings`, writing a typed figure as `stated` (a typed exact value beats
an `estimated` bracket; a range-chip pick stays `estimated`). Without this, a user who types an exact
debt/savings on the new numpad screens still silently gets bucketed to a midpoint.

**✅ Backend landed (2026-06-16).** `patchFromOnboarding` second arg is now an `OnboardingExact`
object `{ income?, savings?, debt? }` (was a bare `exactIncome`); each field, when a finite `>= 0`
exact is given, writes `stated` and wins over the bracket; otherwise the bracket midpoint stays
`estimated`. Exact debt seeds one coarse `stated` line (`name: 'Debt'`); the first roast itemizes.
`seedSnapshotFromOnboarding` + both existing callers (`OnboardingScreen`, `FinancialContextScreen`)
updated to the object shape (still passing income only). **Frontend remaining (next session):** the
numpad debt/savings screens must pass `exact.savings` / `exact.debt`. **⚠️ Note:** writing exact debt
as a `stated` single line is dormant until the frontend wires it — and its interaction with the
roast-itemization overwrite is part of the **#3/#5 merge redesign** (a `stated` onboarding debt line
would block a later *inferred* roast from itemizing it; the per-debt merge in #3/#5 must resolve that).

---

## 3. Confidence-level merge mishandles a debt payoff — 🔴 MUST revisit before launch · 📋 planned → [`docs/debts-table.md`](../debts-table.md)

> **Root-caused (2026-06-16):** the empty-debts array is overloaded — `patchFromAnalysis` drops
> `debts: []` as "no signal", so an explicit "I paid off all my debts" (→ `[]`) is indistinguishable
> from "this roast didn't mention debt" (→ `[]`) and the stale line is kept. Fix = a storage-agnostic
> `debtsCleared` signal on analyze (Part A, the launch-blocker) + per-debt provenance for #5
> stickiness (Part B). Full design + build plan: [`docs/debts-table.md`](../debts-table.md).

**Symptom (observed with AI mocks OFF, against the real backend):** the user's snapshot was roughly
**$10k+/mo income, $50k savings, $2k debt**, and the roast input was **"I paid off all my debts."**
The confidence-gated merge mishandled the update — the user-stated payoff didn't land cleanly, which
degraded the experience (the app didn't reflect "debt now $0").

**Likely root causes to investigate** in the confident-merge engine (`mergeSnapshot` /
`patchFromAnalysis` / `mergeIntoSnapshot`, `shared/financialSnapshot.ts`):
- The merge may not distinguish **"writer is silent on debts"** (→ keep the stored value) from
  **"writer explicitly zeroed debts"** (→ overwrite to `$0`). An empty/zero `debts` from analyze can
  be read as "no info given," so the stale $2k debt is kept.
- **Confidence gating:** if the stored $2k debt is high/`stated` confidence and the payoff update
  arrives at lower confidence, the `incoming ≥ stored` rule **blocks** the (correct) zeroing — so a
  real, explicitly-stated payoff is ignored.

**Why it's launch-blocking:** this is core trust. A user who says "I paid it off" and still sees the
debt won't trust the product. Revisit the confidence ladder + the silent-vs-explicit-zero distinction
(especially for the `debts` array) before launch.

---

## 4. Rename score band "Financially Fragile" → "Cooked" — ✅ done (2026-06-16)

Decision (2026-06-15): rename the lowest band label to **"Cooked"** — one word, on-brand, shareable.
**Thresholds unchanged (40/60/80)** — label only, so historical scores keep their band; only the bottom
band's *text* changes. (We weighed Gemini's 0–30 cutoff too, but kept 40/60/80 — moving it widened
"Surviving" to a mushy 31–60 and reclassified existing scores for no clear gain.)

`shared/scoring/bands.ts` is the source of truth, but the `"Financially Fragile"` literal is actually
referenced in several live spots — update all of them (grep the literal; the frozen `tools/eval/*` and
`tools/test-snapshots/*` JSON artifacts can be ignored):

- `shared/scoring/bands.ts` — the `ScoreBand` label union + `getScoreBand`'s ≤40 return. **(source)**
- `src/screens/OnboardingScreen.tsx` — `reactionFor` keys off `label === 'Financially Fragile'`.
- `src/components/ScoreRing.tsx` and `src/components/AnalyzingHero.tsx` — label references.
- `shared/scoring/__tests__/bands.test.ts` — assertions.
- `supabase/functions/action-plan/prompt.ts` — the action-plan **LLM prompt** names the band label;
  update it too or the model will cite a stale label. (`analyze/prompt.ts` does NOT reference it.)
- `docs/planned-ui-improvements.md` — doc mention.

Ripple is otherwise contained: the label renders on every score surface (ScoreRing, Dashboard, Results,
History, community feed, BrokeCard) via `getScoreBand`, so the single source change propagates. No
threshold/score change.

**✅ Done (2026-06-16).** All seven live spots above renamed to **"Cooked"**. Confirmed the runtime
`scoreLabel` derives from `getScoreBand().label` (`shared/scoring/index.ts:33`), so the single source
edit propagates to analyze/captions output too. `bands.test.ts` assertions updated (pass). Verified no
type-checked `'Financially Fragile'` literal remains in `src/`/`shared/`. **Left as-is:** the frozen
`tools/eval/*` + `tools/test_anthropic.ts` fixtures still carry the old label (excluded from tsc, paid
eval harness, out of scope) — refresh them only if eval-input fidelity matters. **Historical data:**
stored `analyses.score_label` rows keep "Financially Fragile" (immutable history, not migrated); any
surface that recomputes via `getScoreBand` shows "Cooked", a surface reading the stored label shows the
old text — confirm display reads `getScoreBand` (it does on score surfaces) during the frontend pass.

---

## 5. Manual debt CRUD (add / edit / delete individual debts) — 📋 planned → [`docs/debts-table.md`](../debts-table.md) · coupled to #3

> **Decided (2026-06-16):** debts move to a dedicated **`debts` table** mirroring `tracked_subscriptions`
> (per-row RLS + CRUD) **plus per-row `source`/`confidence`** (the part subscriptions don't need, because
> the roast LLM writes debts). The UI editor below is the frontend half; the data model + reconcile +
> migration are speced in [`docs/debts-table.md`](../debts-table.md). Build next dedicated backend session.

**Gap:** today debts only enter two ways — **roasts** (the analyze LLM extracts the `debts` array) and
**check-ins** (`updateSnapshotDebts` updates *existing* balances, matched **by name** —
`src/services/financialSnapshot.ts:107`). There is **no way for a user to add a missed debt, correct a
wrong balance/APR/name, fix the `kind`, or delete a hallucinated one.** (`FinancialContext` only edits
demographic brackets, not per-debt items.) Debts feed **both the score AND the Debt Payoff plan**, so an
uncorrectable error has bigger downstream impact than a wrong subscription — and a mis-tagged `kind`
(e.g. a mortgage read as `personal`) wrongly enters the payoff planner.

**Build:** per-debt CRUD on the snapshot's `debts` array — add / edit / delete, all fields (name,
balance, `interestRate`/APR, `minimumPayment`, **`kind`**). UI is a **dedicated Debts CRUD screen**
mirroring the Subscriptions screen, reached from a **Debts summary card** on the Financials tab (total
debt + count). Debt counts are **unbounded** — and the app's core audience (the genuinely broke) tend to
carry the *most* debts and need this most — so it follows the same managed-list pattern as subscriptions,
not an inline list. (`debts` array schema caps LLM-extracted debts at 8; manual entry should handle a
similar range cleanly.)

⚠️ **Merge-stickiness — same problem as #3.** A manual debt edit must write **`stated`/manual confidence
and be sticky**: a later *inferred* roast value must NOT overwrite the user's correction. This is the
same confidence-ladder / user-stated-is-authoritative work as the #3 payoff bug — **do them together**.
`mergeSnapshot` / `patchFromAnalysis` / `updateSnapshotDebts` (`shared/financialSnapshot.ts`) need to
(a) accept a manual per-debt write at top confidence, and (b) never let an inferred write clobber it.

**Touch-points:** `shared/financialSnapshot.ts` (merge + a manual-debt patch path) ·
`src/services/financialSnapshot.ts` (a manual `upsertDebt` / `removeDebt` service) · the Financials
"The Debt" UI (inline editor). The `kind` selector is load-bearing — it gates mortgage-vs-payoff
treatment.
