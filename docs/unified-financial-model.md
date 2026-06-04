# Unified Financial Model + Mandatory Onboarding — Design

Status: **design only, not implemented.** Companion to `docs/active-plan-design.md` and
`docs/DECISIONS.md`. Drafted 2026-06-04.

## 0. Why

Today every feature reads **"the latest roast"** as if it were the user's current
financial state. There is no single maintained truth, and the data we collect doesn't
reconcile:

- **Roasts (`analyses`)** are independent point-in-time snapshots; the latest one is the
  de-facto "current state" for Action Plan, Debt Payoff, and captions.
- **Financial Context (`profiles.ctx_*`)** is a *coarse* personalization profile (income
  *bracket*, debt *bracket*, etc.) fed into the roast prompt — and it's currently optional.
- **Check-ins (`check_ins`)** capture precise figures + pinned-goal metrics over time, but
  only reach the Active Plan (the "since you started" delta + staleness gate); Debt Payoff
  and captions never see them.

Consequence: a check-in updates `check_ins` but **not** the debts Debt Payoff reads; to move
Debt Payoff you must re-roast. Debt Payoff is a stateless calculator over the latest roast's
`debts[]`. The app feels like independent calculators hanging off the most recent roast.

**Goal:** one **financial snapshot** = the user's live current financial state, *written* by
onboarding + roasts + check-ins and *read* by every feature; plus a **mandatory, digestible
onboarding** that seeds it so advice is accurate from day one.

---

## 1. The financial snapshot (the unifying object)

A single per-user record of the **current** numbers — distinct from `analyses` (immutable
history) and `check_ins` (the progress time-series).

### 1.1 Shape
```
financial_snapshot (one row per user)
  user_id
  monthly_income        number        // precise current figures
  monthly_expenses      number
  monthly_savings       number        // income − expenses (derived, stored for reads)
  liquid_savings        number
  debts                 jsonb[]        // [{ id, name, balance, apr, min_payment }]
  debt_total            number
  // derived metrics (stored so features don't recompute):
  savings_rate          number
  emergency_fund_months number
  debt_to_income        number
  score                 number | null  // last roast's health score
  // provenance — per snapshot, the most-recent authoritative write:
  source                'onboarding' | 'roast' | 'checkin' | 'manual'
  source_analysis_id    uuid | null
  confidence            'estimated' | 'stated'   // onboarding=estimated, roast=stated
  updated_at            timestamptz
```

### 1.2 Where it lives
A new `financial_snapshots` table (one row/user, upserted), RLS own-row — `debts` as JSONB,
metrics as columns. (Considered: columns on `profiles`; rejected — `debts[]` + provenance +
the metric set bloat the profile row and muddle "identity/personalization" with "live state".)

### 1.3 Write paths (who updates it)
- **Onboarding** → seeds it once (coarse, `confidence: 'estimated'`) from the bracket answers
  (see §2). So the *first* roast and all features start from a real baseline, not zeros.
- **Each roast** → overwrites with precise numbers from the `FinalAnalysis`
  (`confidence: 'stated'`, `source: 'roast'`, `source_analysis_id`). A roast is a *full*
  re-statement → it replaces.
- **Each check-in** → *patches* only the fields the check-in touched (income/expenses/debt/
  savings) + recomputes derived metrics; `source: 'checkin'`. A check-in is a *delta* → patch,
  don't replace.
- **Manual edit** (the Financial Context screen, or a future "edit my numbers") → patch.

Reconciliation rule: **most-recent authoritative write wins per field**; a roast replaces the
whole snapshot, a check-in/manual patches named fields. `updated_at` + `source` make every
value traceable.

### 1.4 Read paths (who consumes it)
Replace "latest analysis" reads with snapshot reads:
- **Debt Payoff** → reads `snapshot.debts` (not `route.params` from the latest roast) → can
  become a *tracked* strategy (remember chosen method, track paydown across check-ins) instead
  of a stateless calculator.
- **Active Plan** → `start_metrics` + the staleness gate (`shouldRevisePlan`) compare against
  the **snapshot** (today they compare against the latest check-in) — one source for "are you
  on track / has your situation changed."
- **Dashboard / captions** → read current numbers from the snapshot.

### 1.5 Coexistence (no data thrown away)
- `analyses` stays the **immutable history** (every roast; trend, "All Roasts", re-score-from).
- `check_ins` stays the **progress time-series** (pinned goals over time).
- `profiles.ctx_*` stays the **coarse personalization** fed to the roast prompt (demographic
  flavor: state, age, housing, employment) — *not* the precise ledger.
- The **snapshot** is the merge target = the one "current state" everything reads.

---

## 2. Mandatory onboarding (post-login) — seeds the snapshot

Right after account creation, a **mandatory, digestible, multi-step** flow that captures
identity + a financial baseline, so the first roast and every feature are accurate.

### 2.1 Where it sits in the flow
The flow already exists: `Login → UsernameSetup → Onboarding → MainTabs`, gated by
`useAuth().needsUsername` / `needsOnboarding` and `profiles.onboarded`. We **expand the
Onboarding step** into the staged flow below; `onboarded` flips true only on completion (the
gate is already enforced by the navigator).

### 2.2 Principle: one concept per screen, brackets over typing
The current Financial Context is a single long form (overwhelming + skippable). Split it into
**bite-size steps** — one clear question each, large tappable chips, a progress indicator,
back/next. Brackets = taps (fast = high completion); precise numbers come naturally from the
first roast's free text, so onboarding stays short.

### 2.3 The steps
1. **Name** — First + Last (new `profiles.first_name` / `last_name`). Personal; powers the
   greeting ("Good morning, {first}") and tone.
2. **Where you live** — state (`ctx_state`) → drives regional cost-of-living baselines.
3. **Age** — `ctx_age_bracket`.
4. **Housing** — renting / owning / with family / dorm / other (`ctx_living_situation`).
5. **Employment** — full-time / part-time / self-employed / student / between jobs
   (`ctx_employment_status`).
6. **Income** — monthly bracket (`ctx_income_bracket`).
7. **Debt** — total bracket (`ctx_debt_bracket`); "none" short-circuits debt follow-ups.
8. **Savings** — liquid bracket (`ctx_liquid_savings_bracket`).

(Steps 2–8 are exactly the existing `CONTEXT_FIELDS`, just **mandatory** and **paginated**.)

### 2.4 What onboarding writes
- `profiles`: `first_name`, `last_name`, all `ctx_*`, `onboarded = true`.
- **Seeds the snapshot** (`source: 'onboarding'`, `confidence: 'estimated'`): brackets →
  midpoint estimates (e.g. income `4k_6k` → ~$5,000/mo; debt `5k_15k` → ~$10,000). These give
  features a real starting baseline; the first roast then overwrites with `'stated'` precision.

### 2.5 Why mandatory + brackets (not exact figures)
- **Mandatory** → no user lands on a roast/feature with zeroed context; advice is tuned from
  the first interaction (the user's stated goal).
- **Brackets, not exact** → fast (low friction = completion), and enough to *seed* accuracy.
  The free-text first roast captures exact numbers without an extra form.

---

## 3. End-to-end data flow

```
Login → UsernameSetup → Onboarding (name + brackets, mandatory)
            │ writes profiles (names, ctx_*, onboarded=true)
            │ seeds financial_snapshot  (estimated)
            ▼
First roast (analyze)  ── overwrites snapshot (stated, precise) ──► snapshot = current truth
            │
   ┌────────┴───────────────┬───────────────────────┐
   ▼                        ▼                         ▼
Action Plan            Debt Payoff               Captions / Dashboard
(reads snapshot;       (reads snapshot.debts;    (read snapshot)
 staleness vs it)       tracked strategy)
            ▲
Check-in  ── patches snapshot (changed figures) ──┘   + writes check_ins time-series
```

---

## 4. Migration

- `profiles`: add `first_name TEXT`, `last_name TEXT`.
- New `financial_snapshots` table (RLS own-row); one row/user, upsert.
- **Backfill existing users:** seed each snapshot from their most-recent `analyses` row
  (precise) where present; mark `onboarded = true` for users who already have analyses
  (grandfather — don't force the new flow on existing users), else route them through it.
- Reuse the existing `onboarded` flag + `needsOnboarding` gate.

---

## 5. Phasing

- **Phase 1 — onboarding (ships value alone):** the staged mandatory flow (names + split
  context) + write `profiles` + seed snapshot estimates. Immediately improves first-roast
  accuracy + unlocks the greeting; no feature-read changes yet.
- **Phase 2 — the snapshot as source of truth:** `financial_snapshots` table + write from
  roast/check-in/manual; migrate **Active Plan** (staleness vs snapshot) and **Debt Payoff**
  (read `snapshot.debts`) off "latest roast."
- **Phase 3 — tracked features:** Debt Payoff remembers the chosen strategy + tracks paydown
  across check-ins; Dashboard/captions read the snapshot; retire the per-roast `route.params`
  hand-offs.

The only genuinely new engineering is the `financial_snapshots` table + its write/read wiring
and the onboarding pagination. Bracket→estimate and the prompt personalization already exist.

---

## 6. Open decisions (resolve before building)

- **Snapshot storage:** dedicated table (recommended) vs `profiles` columns.
- **Bracket → number estimates:** midpoints, or store the bracket + a derived estimate? How is
  `confidence: 'estimated'` surfaced to the user ("based on your rough estimates")?
- **Onboarding length:** 8 steps may still feel long — combine any (e.g. age+housing)? Which
  fields are truly mandatory vs "skip for now" (the spec says all mandatory)?
- **Names:** required (per spec). Confirm display rules (first-name greeting; full name where?).
- **Grandfathering:** auto-onboard existing users from history, or require the flow once?
- **Reconciliation conflicts:** exact per-field "most-recent-source-wins" rules; does a roast
  ever *not* fully replace (e.g. it omitted debts the user has)?
- **Re-onboard / edit:** the Financial Context screen becomes "edit my profile + numbers" that
  patches the snapshot — confirm that's the single edit surface.
