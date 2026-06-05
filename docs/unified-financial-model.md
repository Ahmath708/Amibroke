# Unified Financial Model + Mandatory Onboarding — Design

Status: **Phases 1–2 shipped & stress-validated.** Onboarding (debt-free), the snapshot,
confident-merge, option-B provenance, and Findings A/B are live. **Remaining:** the check-in
reframe (§7) and Phase 3. Companion to `docs/active-plan-design.md`. Drafted 2026-06-04, updated
2026-06-05.

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

**Storage layout (DECIDED, #2):** flat columns for the **derived metrics features read** +
one **`provenance` JSONB** for per-field `{value, source, confidence, updated_at}` + a
**`debts` JSONB**. Queryable where it matters, flexible where it doesn't.
```
financial_snapshots (one row per user)
  user_id
  // Derived metrics — flat columns (what Active Plan / Debt Payoff / Dashboard read):
  monthly_income, monthly_expenses, monthly_savings, liquid_savings,
  debt_total, savings_rate, emergency_fund_months, debt_to_income   numeric
  score                 numeric | null            // last roast's health score
  debts                 jsonb                     // [{ id, name, balance, apr, min_payment, kind }]
  // Per-field provenance — { value, source, confidence, updated_at } keyed by field:
  provenance            jsonb
  updated_at            timestamptz
```
`source ∈ 'onboarding' | 'roast' | 'checkin' | 'manual'`.

**Confidence ladder (DECIDED, #1) — one ordering the merge compares against:**
```
estimated (inferred) < low < medium < high < stated
```
Onboarding bracket / midpoint → `estimated`; exact-entry or an explicit statement → `stated`.
A roast's numbers map by their existing `low | medium | high` confidence; the option-B
`source: 'user_stated'` overrides to `stated`. The merge (§1.3) updates a field only when the
incoming confidence is **≥** the stored one, and **never** downgrades `stated`.

**Exact-when-known, bracket as fallback.** The snapshot stores the **exact** figure; the
coarse **bracket** lives on `profiles.ctx_*`. Whenever an exact value is set (onboarding's
optional exact entry, or a roast that yields a precise number), we set the exact value **and
re-derive the bracket** so the two never drift. The AI prompt **prefers the exact figure and
falls back to the bracket** — accuracy scales with what the user gave us.

**Derived-metric determinism (Finding B, shipped).** `monthlySavings` / `savingsRate` are
asserted ONLY when income AND expenses are both known (stated/high — expenses count as known when
reconciled from a stated monthly-savings figure: the analyze prompt sets `expenses = income −
stated savings`). When expenses are merely inferred there is no deterministic basis, so they
default to **0** rather than fabricate a rate (under-claim > over-claim).

**Debt is a kind-tagged collection (Finding A, shipped).** Each debt carries
`kind ∈ credit_card | student_loan | auto | mortgage | medical | personal | other`. Mortgages are
excluded from `debt_total`, DTI, and Debt Payoff via `isPayoffDebt` — a mortgage isn't consumer
debt you "dig out of," and the analyze prompt won't fabricate a mortgage/auto *balance* from a
*payment*.

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
- **Each check-in** → *patches* the **scalar** fields it touched (income/expenses/savings) as
  `stated`; recomputes derived metrics. **Debt is deferred to the check-in reframe (§7)** — a
  check-in *total* can't itemize without clobbering per-debt APRs; per-debt tracking is the fix.
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

### 2.3 The steps (5 screens) — SHIPPED
A trust-first intro, then grouped chip steps; progress bar; "Continue" disabled until answered;
no skip.
0. **Intro** — "First, your money profile" + 3 benefit/trust rows ("Set it up").
1. **Name** — First + Last (`profiles.first_name` / `last_name`). Powers the greeting + tone.
2. **About you** — state (`ctx_state`) + age (`ctx_age_bracket`).
3. **Your situation** — housing (`ctx_living_situation`) + employment (`ctx_employment_status`).
4. **Income** — monthly bracket (`ctx_income_bracket`) **+ optional exact-$ entry** (number-only).
5. **Savings** — liquid-savings bracket (`ctx_liquid_savings_bracket`).

**Debt is NOT collected at onboarding** (decided 2026-06-05). Debt is a multi-entity, kind-tagged
concept; a generic total bracket produced a throwaway placeholder and couldn't carry a `kind`. The
**first roast itemizes debts** (name/balance/APR/kind) instead — far richer, and it keeps
onboarding short. Income/savings stay as brackets (they're scalars).

### 2.4 What onboarding writes — SHIPPED
- `profiles`: `first_name`, `last_name`, `ctx_*` (income/savings/state/age/housing/employment),
  `onboarded = true`. Exact income → `monthly_income`.
- **Seeds the snapshot** (income + savings only, via `patchFromOnboarding`): exact → `stated`,
  bracket → `estimated` midpoint. **No debt is seeded** (no synthetic placeholder). The first
  roast then refines via confident-merge (§1.3).

### 2.5 Why mandatory + brackets (not exact figures)
- **Mandatory** → no user lands on a roast/feature with zeroed context.
- **Brackets (+ optional exact)** → fast (taps = high completion); the free-text first roast
  captures exact figures + itemized debts without a longer form.

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

- `profiles`: `first_name` / `last_name` (00020 ✅) + `monthly_income` (00021 ✅) +
  `preferred_tone` (00024 — sticky roast voice; ⏳ **NOT pushed yet** — run `supabase db push`).
- `financial_snapshots` table + RLS + **eager grandfather backfill** from each user's most-recent
  `analyses` row (00022 ✅). One read path; no "if-no-snapshot" fallback code.
- `check_ins.reflection TEXT` (00023 ✅ — persists the Haiku reflection for the timeline).
- Debt `kind` + per-number `source` are **optional schema fields** (no migration — JSONB/`debts[]`).
- Reuses the existing `onboarded` flag + `needsOnboarding` gate.

**Bracket → number midpoints** — used to seed `estimated` values when no exact figure is given
(income + savings only; **no debt** — onboarding doesn't collect it):
| income | $ | savings | $ |
|---|---|---|---|
| under_2k | 1,500 | none | 0 |
| 2k_4k | 3,000 | under_500 | 250 |
| 4k_6k | 5,000 | 500_2k | 1,250 |
| 6k_10k | 8,000 | 2k_10k | 6,000 |
| over_10k | 12,000 | 10k_50k | 30,000 |
| | | over_50k | 65,000 |

---

## 5. Phasing

- **Phase 1 — onboarding ✅** mandatory staged flow (intro + name + brackets) → `profiles`;
  first-name greeting; brackets into the roast prompt.
- **Phase 2a — snapshot foundation ✅** `financial_snapshots` + eager backfill; seed from
  onboarding; client-side confident-merge (`shared/financialSnapshot`); Active Plan staleness +
  Debt Payoff now read the snapshot. 17 unit tests.
- **Phase 2b — provenance precision ✅** analyze option-B (`source` per number + `debts`) deployed,
  **eval 13/13**; merge consumes `source`; check-in writes scalars. Prompt moved to a static
  `prompt.ts` (the `.txt` deploy landmine — see CLAUDE.md gotcha).
- **E2E stress test ✅** `tools/snapshot-e2e.ts` drove 6 real cases through seed → roast → merge →
  payoff → plan, calling Anthropic directly. Surfaced + fixed Findings A & B (§6).
- **Onboarding debt-drop ✅** (2026-06-05) — debt removed from onboarding (§2.3).
- **Check-in reframe ✅** (2026-06-05, §7) — soft-monthly emotional ritual: pulse-led flow,
  per-debt → snapshot, Haiku reflection, streak, journey timeline. Closes the check-in→debt gap.
- **Sticky roast voice ✅** — `profiles.preferred_tone` (00024, ⏳ push pending) is the single
  source of truth for tone; the HomeScreen selector + Settings write it; the reflection reads it.
- **Phase 3 — tracked features:** Debt Payoff remembers the chosen strategy + tracks paydown
  across check-ins; Dashboard/captions read the snapshot; retire per-roast `route.params`
  hand-offs; move the merge server-side for authority; manual edit surface; derived-metric
  "estimated" badges; real-DB run with mocks off.

---

## 6. Decisions

**Resolved (Phase 2a is build-ready):**
- **#1 Confidence ladder** — `estimated < low < medium < high < stated`; merge needs ≥, never
  downgrades `stated` (§1.1).
- **#2 Storage** — dedicated `financial_snapshots`; flat metric columns + `provenance` JSONB +
  `debts` JSONB (§1.1).
- **#3 Bracket midpoints** — table in §4.
- **#4 Grandfathering** — eager backfill from the latest analysis in the migration (§4).
- **#5 Merge placement** — client-side `shared/` fn for v1; server-side later as hardening (§1.6).
- Onboarding: ~5 grouped mandatory steps; first/last name; greeting uses `first_name` (Phase 1, done).

**Findings from E2E stress testing (resolved 2026-06-05):**
- **Finding A — debt `kind`:** secured debt (mortgage/auto *inferred from monthly payments*)
  polluted `debt_total`/DTI/payoff (DTI 410%, a 206-mo mortgage "payoff"). Fixed: `kind` field;
  mortgages excluded via `isPayoffDebt`; prompt won't fabricate a balance from a payment. Live.
- **Finding B — savings determinism:** inferred expenses produced a phantom savings rate (37% vs
  the stated ~4%). Fixed: the prompt reconciles `expenses = income − stated savings`, and the
  snapshot asserts `savingsRate` only when income+expenses are known, else 0. Live.
- **Onboarding debt-drop:** debt removed from onboarding (§2.3) — the first roast itemizes it.
- **Sticky roast voice:** tone is a persisted **profile preference** (`preferred_tone`), the single
  source of truth read by the reflection (and available to analyze) — not the latest roast's tone
  (which was never persisted, so the reflection had silently always used savage).

**Remaining (Phase 3 / later):**
- **Silent-drop edge:** a field that changed but went unmentioned — lean on check-ins + edit surface.
- **Surfacing `estimated`:** derived-metric "estimated" badges in the UI.
- **Edit surface:** Financial Context → "edit my numbers" that patches the snapshot.
- **Server-side merge** for authority; **real-DB run** with mocks off.

---

## 7. Check-in reframe (DECIDED — soft-monthly emotional ritual)

The **Coach (Active Plan)** is the always-on **progress/plan** hub (% ring, steps, delta,
momentum, staleness gate). To avoid duplicating it, the check-in is what the Coach *isn't*: a
**periodic, emotion-led ritual** that keeps the snapshot honest and builds a journey.

**Cadence — soft monthly (never block).**
- Numbers + feelings are updatable **anytime** (data freshness; never wall an eager/anxious user).
- The **official** check-in (advances the streak + writes the canonical `check_ins` row) is **once
  per monthly window**. The countdown is a *nudge* ("next check-in in N days"), not a gate.
- Streak = consecutive monthly windows with an official check-in.

**The flow (pulse-led):**
1. **Pulse** — mood + optional note (the soul; leads).
2. **Refresh** — targeted, prefilled, skippable updates to tracked goals + **per-debt balances**
   (→ `snapshot.debts` by identity, closing the check-in→debt gap). No generic total-debt field.
3. **Reward** — "what moved since last time" (deterministic delta) + the streak + a personalized
   **reflection** (see LLM).
4. **Handoff** — to the refreshed Coach ("your plan's updated") + optional re-score.

**LLM (model routing).** Core is deterministic + reuses `analyze` (re-score) and `revise-plan`
(plan revision) — both existing **Sonnet** flows. The **one new pass** is the reflection: a short,
empathetic reaction to `{mood, note, delta, planStatus, tone}` → **Haiku** (`claude-haiku-4-5`),
gated to fire only on signal (a note or a meaningful delta), else a template. ~$0.001/check-in.

**History / journey.** `check_ins` already retains every check-in; the soft gate makes it one
clean entry per window. A **timeline view** (date · mood · what-moved · note · reflection) turns
the check-in into a money journal + a visible streak — a core retention/emotional hook.

**Data model.** `check_ins` = the official ritual log (one row/window). Live number updates write
the **snapshot only** (time-series stays clean, snapshot stays fresh). **No schema change except**
`check_ins.reflection TEXT` (00023 — persist the reflection for the timeline).

**Build chunks — all SHIPPED (2026-06-05):** **A** cadence+streak (`shared/checkinCadence`) ·
**B** per-debt→snapshot (`applyDebtUpdates`, match by name) · **C** `checkin-reflection` Haiku edge
fn (static `prompt.ts`; tuned — voice-by-qualities openers, hard ≤160 chars, delta-sign clarity,
emotional-safety floor; `max_tokens` 60) · **D** the UI reframe (pulse-led flow) · **E** streak on
the Home `CheckinCard` · **F** the journey/timeline (reflection per entry in History).

**Presentation.** The check-in is a **standard pushed screen** (header + `slide_from_right`) like
Trend/Roasts — an earlier formSheet attempt let the sheet gesture eat the scroll. A later
"grab-screen" polish pass may revisit a sheet.

**Tone source.** The reflection matches the user's **sticky `profiles.preferred_tone`** (not the
latest analysis — tone was never persisted there, so that path always fell back to savage). Set
from the HomeScreen selector (sticky) or **Settings → App → Roast Voice**.
