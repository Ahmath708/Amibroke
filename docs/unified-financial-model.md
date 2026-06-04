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
Each **input** field carries its own provenance, so writes can MERGE confidently (never
clobber a stated value with an estimate; never zero a field a roast was silent on — see §1.3).
`value` is the **exact** number when known.
```
financial_snapshot (one row per user)
  user_id
  // Input fields — { value, confidence: 'estimated'|'stated', source, source_analysis_id, updated_at }
  monthly_income        Field<number>
  monthly_expenses      Field<number>
  liquid_savings        Field<number>
  debts                 Field<[{ id, name, balance, apr, min_payment }]>
  // Derived (recomputed on every write, stored so features don't recompute):
  monthly_savings, savings_rate, emergency_fund_months, debt_to_income, debt_total
  score                 number | null   // last roast's health score
```
`source ∈ 'onboarding' | 'roast' | 'checkin' | 'manual'`. `confidence`: onboarding bracket →
`estimated`; an exact entry or a roast-extracted figure → `stated`.

**Exact-when-known, bracket as fallback.** The snapshot stores the **exact** figure; the
coarse **bracket** lives on `profiles.ctx_*`. Whenever an exact value is set (onboarding's
optional exact entry, or a roast that yields a precise number), we set the exact value **and
re-derive the bracket** so the two never drift. The AI prompt **prefers the exact figure and
falls back to the bracket** — accuracy scales with what the user gave us. (Generalizes to
income, debt, and savings.)

*(Storage of per-field provenance — JSONB per field vs parallel columns — is an open
decision, §6.)*

### 1.2 Where it lives
A new `financial_snapshots` table (one row/user, upserted), RLS own-row — `debts` as JSONB,
metrics as columns. (Considered: columns on `profiles`; rejected — `debts[]` + provenance +
the metric set bloat the profile row and muddle "identity/personalization" with "live state".)

### 1.3 Write paths (who updates it)
- **Onboarding** → seeds it once (coarse, `confidence: 'estimated'`) from the bracket answers
  (see §2). So the *first* roast and all features start from a real baseline, not zeros.
- **Each roast** → **confidence-aware merge, NOT a blind overwrite.** For each field the roast
  has signal for, update it only if its confidence ≥ the existing field's (a `stated` value is
  never downgraded by an `estimated` one). Fields the roast is **silent on are kept** — a roast
  about spending must not zero the user's debts. An *explicit* statement that a field changed
  ("I paid off the card") is `stated` and updates it, including to 0. A roast that yields a
  precise figure also re-derives the bracket (§1.1).
- **Each check-in** → *patches* only the fields it touched (income/expenses/debt/savings) +
  recomputes derived metrics; `source: 'checkin'`, `confidence: 'stated'`.
- **Manual edit** (the Financial Context screen, or a future "edit my numbers") → patch.

Reconciliation rule: **per field, the higher-confidence + more-recent write wins; never
downgrade `stated` → `estimated`; never overwrite a field with "no signal."** `updated_at` +
`source` per field make every value traceable.

Trade-off (accepted): confident-merge can retain a field that *silently* changed (e.g. debt
cleared but unmentioned). Mitigated by check-ins, the edit surface, and the Active Plan's
"your numbers changed?" prompt — and any explicit mention overrides immediately.

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

### 1.6 Analyze endpoint changes (Phase 2)
The output already carries per-field confidence (`monthlyIncome/monthlyExpenses/liquidSavings`
are `NumberWithConfidence`), so this is additive, not a rewrite:
- **Provenance (DECIDED — option B):** add an explicit `source: 'user_stated' | 'inferred'` to
  each key number, and give `debts` a `source`/`confidence` too (today they have none). The
  snapshot's per-field `confidence` (`stated`/`estimated`) maps directly from this. Additive +
  optional so cached analyses still validate.
- **Input:** enrich the request with the snapshot's known **exact** figures; prompt treats
  exact as ground truth (exact > bracket), marks inferred numbers `inferred`, and restates a
  field the user says changed as `user_stated`.
- **Merge:** a shared confident-merge fn (cross-runtime, like `planRevision`) maps the output
  → snapshot; runs client-side (after analyze) for v1, server-side later for authority.
- **Safety:** it's our most-used PAID endpoint — prompt/schema changes are eval-tested (rule #1)
  before deploy; the merge *wraps* analyze, doesn't rewrite it.

---

## 2. Mandatory onboarding (post-login)

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

### 2.3 The steps (~5 grouped screens)
Related fields are grouped to cut the screen count; each screen = chips + a progress bar +
"Continue" disabled until answered; all mandatory.
1. **Name** — First + Last (new `profiles.first_name` / `last_name`). Powers the greeting
   ("Good morning, {first}") + tone.
2. **About you** — state (`ctx_state`) + age (`ctx_age_bracket`).
3. **Your situation** — housing (`ctx_living_situation`) + employment (`ctx_employment_status`).
4. **Income** — monthly bracket (`ctx_income_bracket`).
5. **Debt & savings** — total-debt bracket (`ctx_debt_bracket`; "none" skips follow-ups) +
   liquid-savings bracket (`ctx_liquid_savings_bracket`).

(Steps 2–5 are the existing `CONTEXT_FIELDS`, grouped + made mandatory. The optional **exact-$
entry** on income/debt/savings is **Phase 2** — it needs the snapshot to store a precise value.)

### 2.4 What onboarding writes (Phase 1)
- `profiles`: `first_name`, `last_name`, all `ctx_*`, `onboarded = true`. **That's it for Phase
  1 — no snapshot yet.**
- In **Phase 2**, `financial_snapshots` is created and *seeded* from these brackets
  (→ `estimated` midpoints), then refined by the first roast via confident-merge (§1.3).
  Phase-1 onboarding already improves accuracy: the brackets flow into the roast prompt as today.

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

- **Phase 1 — onboarding (ships value alone):** ~5 grouped mandatory steps (name + brackets) →
  write `profiles` (`first_name`, `last_name`, `ctx_*`, `onboarded`). Unlocks the first-name
  greeting + flows brackets into the roast prompt (better accuracy). **No snapshot, no
  exact-entry, no feature-read changes** — all deferred to Phase 2.
- **Phase 2 — the snapshot as source of truth:** create `financial_snapshots`; seed from the
  Phase-1 brackets (`estimated`) + add the optional **exact-$ entry**; write from roast
  (confident-merge with the new `source` field) + check-in/manual; migrate **Active Plan**
  (staleness vs snapshot) and **Debt Payoff** (read `snapshot.debts`) off "latest roast";
  **grandfather** existing users (backfill from latest analysis) + define bracket midpoints.
- **Phase 3 — tracked features:** Debt Payoff remembers the chosen strategy + tracks paydown
  across check-ins; Dashboard/captions read the snapshot; retire the per-roast `route.params`
  hand-offs.

The only genuinely new engineering is the `financial_snapshots` table + its write/read wiring
and the onboarding pagination. Bracket→estimate and the prompt personalization already exist.

---

## 6. Open decisions (resolve before building)

- **Snapshot storage:** dedicated table (recommended) vs `profiles` columns; and **per-field
  provenance** layout — one JSONB object per field vs parallel columns
  (`monthly_income`, `monthly_income_confidence`, `monthly_income_source`, …).
- **Bracket → number estimates:** midpoint choice, and how `estimated` confidence is surfaced
  ("based on your rough estimate"). Exact entries override the estimate + re-derive the bracket.
- **Onboarding length:** 8 steps may still feel long — combine any (e.g. age+housing)? Which
  fields are truly mandatory vs "skip for now" (the spec says all mandatory)?
- **Names:** required (per spec). Confirm display rules (first-name greeting; full name where?).
- **Grandfathering:** auto-onboard existing users from history, or require the flow once?
- **Reconciliation (decided: confident merge, §1.3):** remaining edge — detecting that a field
  *should* drop when it silently changed (e.g. debt cleared but unmentioned) without an
  explicit statement. Lean on check-ins + the "your numbers changed?" prompt + the edit surface.
  Also: how confidently must a roast "extract" a field before it counts as `stated`?
- **Re-onboard / edit:** the Financial Context screen becomes "edit my profile + numbers" that
  patches the snapshot — confirm that's the single edit surface.
