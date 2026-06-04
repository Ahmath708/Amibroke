# Active Plan (Model B) — Design

**Status: design-only / parked. NOT implemented.** Model A ("your plan = your latest
roast's plan") ships today — see `docs/DECISIONS.md` → "90-Day Action Plan: per-roast".
This document specs **Model B**, a committed, trackable 90-day program, for when we build it.

---

## 1. What Model B is

Today every roast can produce its own plan (cached on `analyses.action_plan`), and "your
plan" just means the latest one. Model B introduces **one persistent, living 90-day plan
per user**: the user *commits* to a plan, it *locks* a start date, and it's *tracked and
iterated* over the 90 days as their finances change — instead of silently being replaced
every time they re-roast. The journey becomes a first-class object; check-ins measure
progress against it.

---

## 2. Research: foundation-model + deterministic, NOT a trained model

The concern was "we can't train our own model like competitors." Research says that isn't
the bar — the leaders don't train foundation models for this either:

- **Cleo** (closest competitor) published *"Building a financial agent on top of
  commodified LLMs."* Cleo 3.0 runs on **OpenAI's o3** (commodity) and **routes every
  calculation through deterministic tools** to eliminate hallucinations. LLM
  interprets/plans/talks; code does the money math.
- **Copilot** trains only a **narrow XGBoost** model for cash-flow prediction — not a
  foundation model, and separate from coaching.
- **YNAB** is purely **rule-based** forecasting; **Monarch** = deterministic projections +
  "smart goal" nudges.
- Academic eval: general LLMs hit only ~70% accuracy on finance Qs and struggle on complex
  ones — exactly why everyone routes math through code.

**Conclusion:** the trust-critical part is the **deterministic finance engine — which we
already have** (`shared/scoring` CFPB/IRT, `shared/calculations`, `simulateDebtPayoff`).
The "AI" is a commodity foundation model (Claude) with structured I/O. We're on Cleo's
stack minus the parts nobody actually trains.

Sources: Cleo blog (commodified-LLMs, Cleo 3.0, "Cleo vs the rest"); Monarch/Copilot/YNAB
comparisons (Copilot XGBoost vs YNAB rules); arXiv "Can AI Help with Your Personal
Finances?" (~70% accuracy). Links in the chat thread that produced this doc.

---

## 3. Architecture

### Principle
**Claude proposes prose + structure; deterministic code owns every number and decides when
Claude is even called.** (Cleo's principle, and the right one.)

### 3.1 Data model (Postgres — deterministic)
- `active_plans` — one active row per user (partial unique index on `status='active'`):
  `id, user_id, source_analysis_id, started_at, horizon_days (90), status
  (active|completed|abandoned), version, overall_message, created_at, updated_at`.
- `plan_steps` (table, or `steps` JSONB on the plan): per step
  `{ id, week, title, description, category, status (pending|done|skipped), completed_at,
  source ('ai'|'deterministic'), target }`.
- Progress is measured against the existing `check_ins` rows over time. Keep prior
  `version`s for the "how my plan evolved" history.

### 3.2 The linchpin — make steps *machine-measurable*
Today's AI steps are prose (`title/description/impact`). Extend the action-plan Zod schema
so each step also carries a **structured `target`**, e.g.
`{ kind:'debt_paydown', account:'cc', amount:400 }` or `{ kind:'build_efund', target:1000 }`
or `{ kind:'cut_spend', category:'dining', amount:120 }`.
**This single addition is what lets deterministic code track progress without the LLM.**
(Same tool-call / structured-output pattern we already use in `analyze` via
`submitAnalysisTool`.)

### 3.3 Lifecycle

**(a) Commit — Claude, once.** "Start my plan" → reuse the existing `action-plan` edge
function (Claude, Zod-validated) → persist as the active plan with `started_at = now`. That
is the lock.

**(b) Track — 100% deterministic, $0.** Users tick steps done; and on each check-in, code
compares each step's structured `target` to the current numbers and recomputes progress %,
on-track/behind/done, and projections (payoff timeline via `simulateDebtPayoff`, savings
runway, score). **No LLM** for the day-to-day "alive" feel.

**(c) Iterate — deterministic gate → Claude revise.**
- *Cheap path (every check-in):* deterministic re-projection. Plan unchanged; status +
  projections update.
- *Expensive path (only on a material change):* a **rules-based trigger** — income moved
  >~15%, a target account hit $0, user materially off-track, OR the user taps "redo my
  plan" — calls Claude with **the current plan + completed/skipped steps + the new
  snapshot** and asks it to **revise the remaining steps** (an *iterate* prompt, not a fresh
  generate) → `version+1`. **Claude proposes; deterministic validates/clamps** the targets
  (e.g. a paydown can't exceed surplus) — Cleo's "route through tools" guardrail.

**(d) Parse free-text input — Claude structured extraction.** "paid off my car," "raise to
$5k," "lost my job" → Claude tool-call → **structured deltas**
(`{ event:'debt_cleared', account:'auto' }`) → feed the deterministic snapshot → may trip
the material-change trigger. Identical pattern to our existing analyze tool-call.

### 3.4 Responsibility split
| Claude owns | Deterministic owns |
|---|---|
| initial generation; revising the plan; parsing messy text → structured deltas (all Zod-validated) | all math/projections; step tracking; **deciding when to call Claude**; validating/clamping Claude's proposed targets |

---

## 4. Cost discipline (we pay per Claude call — repo rule #1)

Claude fires **only** on: commit, material-change revision, explicit redo, free-text parse —
**never** on routine check-ins (those are pure math). Use **prompt caching** (system prompt
+ plan context) on revisions; route the cheap *parse* step to **Groq/Haiku** and keep Sonnet
for generation/revision (the Claude+Groq routing already exists in
`supabase/functions/_shared/client.ts`). Whole feature gated behind the paid tier +
trial (`enforceEntitlement`).

---

## 5. Suggested phasing

- **Phase 1 — mostly deterministic (~80% of the value):** `active_plans` table + commit
  (reuse existing Claude gen) + the **measurable-`target` schema** + manual step completion
  + deterministic progress/projection on check-in. **No Claude revision yet** — a re-roast
  just offers "adopt as new plan." Low LLM cost; ships the "one living plan" model.
- **Phase 2:** material-change trigger + Claude revision + version history + free-text input
  parsing.
- **Phase 3 (optional):** proactive nudges / agentic tool-use (Cleo-style); a narrow
  categorization ML *only if* Plaid lands later.

The only genuinely new engineering is the `active_plans` schema, the measurable-`target`
extension, and the rules-based "when to call Claude" gate. Generation + parse reuse
machinery we already have.

---

## 6. Open decisions (resolve before building)

- **Materiality thresholds** for the revision trigger (income %∆, off-track %, account-zero).
- **Re-roast behavior:** replace the active plan, or branch/version it, or prompt "adopt"?
- **Versioning/history UX:** how (and how much of) plan evolution is surfaced.
- **Coexistence** with the existing per-analysis `action_plan` cache (Model A artifacts).
- **Entitlement:** which tier owns the active plan + check-in-driven iteration.
- **Check-in cadence vs the 90-day clock:** monthly check-ins over a 90-day plan = ~3 data
  points; decide if that's enough signal or if we prompt lighter weekly self-reports.
