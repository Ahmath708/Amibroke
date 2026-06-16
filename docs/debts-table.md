# Debts table — design & build plan (#3 + #5)

> **Status:** 🟢 backend implemented (2026-06-16) — code in, `tsc` + tests green. **Gated steps remain:**
> push migration `00002` to the live DB, redeploy `analyze` (prompt changed), and a paid eval of the
> `debtsCleared` signal (rule #1). In dev (`USE_AI_MOCKS`) it runs fully on an in-memory debt store.
>
> **Landed:** `reconcileDebts` + `debtTotalFromRows` + `withDebtsMirror` (shared, 36/36 tests) ·
> `00002_debts_table.sql` (table + RLS + active index + soft-delete + backfill) · `src/services/debts.ts`
> (CRUD + soft-delete tombstone + `reconcileFromAnalysis` + `applyCheckinBalances` + `getDebtContext` +
> mock store) · snapshot-service rewire (`updateSnapshotFromAnalysis` reconciles debts; onboarding seeds
> a debt row; `updateSnapshotDebts` delegates; `buildRescoreInput` += debt context) · `debtsCleared` on
> `AIRawOutputSchema` + analyze prompt instruction · GDPR export/delete. **Chose the MIRROR variant**
> (kept `financial_snapshots.debts` JSONB as a denormalized cache synced by the service) so existing read
> sites needed no change. **Deferred (fast-follow):** the §3.1 `other`-line / §8 Q5(a) `debtTotalStated`
> stated-total reconciliation.
>
> **Original plan below** (some details — e.g. "drop the JSONB" — were superseded by the mirror choice).
> **Supersedes** the JSONB-array debt model inside `financial_snapshots`.
> **Closes** redesign follow-ups **#3** (debt-payoff merge bug, 🔴 launch-blocker) and **#5** (manual
> per-debt CRUD) — see [`docs/redesign/claude-redesign-6-15-2026.md`](redesign/claude-redesign-6-15-2026.md).
> Read alongside [`docs/unified-financial-model.md`](unified-financial-model.md) (the snapshot model).

---

## 1. Why this exists

Debts today live as a **JSONB array inside `financial_snapshots.debts`**, with a *single* provenance
entry for the whole `debts` field (in the snapshot's `provenance` JSONB). That one overloaded blob is
the root of two problems:

### #3 — "I paid off all my debts" doesn't zero the debt (🔴 launch-blocker)
Observed with mocks OFF on a real backend: snapshot ~$10k/mo income, $50k savings, **$2k debt**; roast
input **"I paid off all my debts"** → the app still showed the $2k. **Root cause:** the empty-debts
array is *overloaded*. `patchFromAnalysis` (`shared/financialSnapshot.ts`) does
`if (Array.isArray(a.debts) && a.debts.length > 0)`, so `debts: []` from analyze is treated as
**"no signal → keep stored."** That guard is correct for a roast that simply doesn't mention debt — but
it makes **"I cleared everything" (→ `[]`)** byte-identical to **"this roast didn't discuss debt"
(→ `[]`)**, and we chose the keep-stale reading. The confidence ladder is a *secondary* factor: the
merge uses `incoming ≥ stored`, so an equal-confidence (`stated`) payoff *would* win the tie — but it
never reaches the merge because the empty-array guard drops it first.

### #5 — no per-debt correction (and merge-stickiness)
Debts only enter via **roasts** (LLM extracts the array) and **check-ins** (`updateSnapshotDebts`
updates *existing* balances, matched by name). There's **no way to add a missed debt, fix a wrong
balance/APR/name/`kind`, or delete a hallucinated one.** And a manual fix must be **sticky** — a later
*inferred* roast must not silently clobber it. With one provenance entry for the whole array, you can't
say "this debt is a user-stated correction, that one is an inferred roast guess."

### Why a dedicated table (and not per-debt provenance in the JSONB)
We weighed embedding per-debt provenance inside the JSONB array vs. a dedicated table. **Decision: a
dedicated `debts` table**, because:
- **Precedent:** the user's recurring expenses already live in **`tracked_subscriptions`** — a dedicated
  table with per-row RLS (`FOR ALL USING auth.uid() = user_id`) and simple `get/save/delete` CRUD
  (`src/services/subscriptionAudit.ts`), plus a `getSubscriptionContext()` line injected into the roast
  input. Debts are the same *shape* of thing (user-stated context that also feeds the roast), so they
  should follow the same proven pattern rather than a bespoke JSONB scheme.
- **Unbounded N:** "debts are < 10" is an assumption with no guarantee. A table doesn't read-modify-write
  a growing per-user blob and gives stable UUID identity + row-level concurrency.
- **Explicit deletion:** per-row deletes make #3 cleaner than zeroing an overloaded array.

### ⚠️ The one way debts are NOT like subscriptions
Subscriptions are **only ever user-entered** — the LLM never writes them, so they need no provenance and
no merge (trivially authoritative). **Debts are written by the roast LLM too** (and feed the score + the
Debt Payoff planner), so the debts table must carry the one thing subscriptions don't: **per-row `source`
+ `confidence`**, plus a **confidence-gated reconcile** so a later *inferred* roast can't overwrite a
*manual* (`stated`) row. The table stores that provenance in columns instead of JSON fields — but the
reconcile logic is required wherever debts live. This doc is "`tracked_subscriptions` shape **+ provenance
columns + a reconcile step**."

---

## 2. Schema (migration `00002_debts_table.sql`)

```sql
CREATE TABLE debts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  balance      NUMERIC NOT NULL,
  apr          NUMERIC,                          -- nullable; 0/unknown allowed
  min_payment  NUMERIC,
  kind         TEXT CHECK (kind IN ('credit_card','student_loan','auto','mortgage','medical','personal','other')),
  source       TEXT NOT NULL DEFAULT 'manual'    -- 'roast' | 'manual' | 'checkin' | 'onboarding'
    CHECK (source IN ('roast','manual','checkin','onboarding')),
  confidence   TEXT NOT NULL DEFAULT 'stated'    -- keep in sync with @shared/financialSnapshot Confidence
    CHECK (confidence IN ('estimated','low','medium','high','stated')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ                       -- soft-delete tombstone (§3.2 conditional re-add guard)
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own debts" ON debts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_debts_user_active ON debts(user_id) WHERE deleted_at IS NULL;  -- active-list reads
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```
> **Soft delete.** `deleteDebt` sets `deleted_at = NOW()` (it does **not** hard-delete). All active reads
> (`getDebts`, `debtTotalFromRows`, `getDebtContext`, the reconcile's "existing" set) filter
> `deleted_at IS NULL`; tombstoned rows are consulted only by the §3.2 re-add guard. GDPR export/delete
> still sweeps the whole table (tombstones included).

### Snapshot changes
- **Drop** `financial_snapshots.debts` JSONB (and the `provenance.debts` entry).
- **Keep** `financial_snapshots.debt_total` and `debt_to_income` as **derived scalar columns** the
  Dashboard/Results/etc. read — recomputed from the `debts` table on every debt change (see §4). The
  snapshot stays the single place features read *current scalar state*; the `debts` table is the source
  of truth for the *itemized list*.

### Data backfill (in the same migration)
Existing users have debts in `financial_snapshots.debts`. The migration must copy each snapshot's array
into `debts` rows, carrying `source`/`confidence` from that snapshot's `provenance.debts` (default
`source='roast', confidence='medium'` if absent). Then drop the JSONB column. `debt_total` already
exists on the snapshot, so no scalar recompute is needed at migration time.

---

## 3. The reconcile algorithm (the real work)

A pure, cross-runtime function in `shared/financialSnapshot.ts` (so the SAME logic serves the post-roast
path on the client and is unit-testable):

```ts
reconcileDebts(existing: DebtRow[], incoming: IncomingDebt[], source, now): DebtPlan
// DebtPlan = { inserts, updates, keeps, deletes } the service then applies.
```

Rules:
- **Match** each incoming debt to an existing row by **normalized name** (case/space-insensitive — same
  as today's check-in matcher). Stable `id` is used once rows exist; roast-extracted debts have no id, so
  name is the join key for the roast path.
- **Per-row confidence gate:** apply an incoming update only when `RANK[incoming.confidence] >=
  RANK[existing.confidence]` — so an **inferred roast (`medium`) never clobbers a manual (`stated`)**
  row. (Same ladder as the scalar merge: `estimated<low<medium<high<stated`.)
- **New incoming names → insert** (`source='roast'`).
- **Existing rows the roast is silent on → keep** (silence ≠ deletion).
- **Explicit clear (`debtsCleared`, see §5) → delete** all non-mortgage rows (`isPayoffDebt`).
- `debtTotalFromRows(rows)` = sum of non-mortgage balances (reuses `isPayoffDebt`; a mortgage stays out
  of payoff/`debt_total`, unchanged from today — Finding A).

Manual CRUD (`upsertDebt`/`deleteDebt`) writes rows at `source='manual', confidence='stated'` directly —
no reconcile needed (the user is authoritative); it just recomputes `debt_total` afterward.

### 3.1 One list, coarse-or-itemized — user-chosen granularity + the `other` line

Debt is **one list** with the invariant **`total = sum(rows)`** — *not* two storage modes. A "coarse
total" is simply a list with a **single line** (the existing `Debt (estimated)` / `kind:'other'` pattern
the onboarding seed already uses). This keeps the model uniform: bracket-comfortable users carry one
"Total debt" line; itemizers carry several named lines; mixed users carry specific lines **plus** an
"Other debt" line for the remainder. (Justified by the §7 decision rule in the redesign doc: itemize
because it drives the Debt Payoff tool AND the lines fully decompose the total.)

Rules layered on top of the §3 reconcile:
- **Granularity is user-chosen and user-initiated.** Collapse-to-total ↔ itemize is an explicit user
  action (an "Itemize" / "Collapse to total" control on the Debt screen). A roast **NEVER auto-switches**
  granularity and **NEVER** causes silent data loss — it only enriches via the sticky merge.
- **Stated-total vs itemized-sum → an `other` line.** When the snapshot carries itemized lines and a
  roast/manual write asserts a **total** that exceeds their sum, reconcile the difference into a single
  `name:'Other debt', kind:'other'` line (`balance = statedTotal − sum(named)`); if the named sum already
  meets/exceeds the stated total, no `other` line is added. This preserves `total = sum` without forcing
  the user to itemize everything. (Depends on analyze conveying a **stated total** distinct from the
  itemized array, and on the coarse line acting as the shrinking remainder bucket so itemizing doesn't
  double-count — see §8 Q5.)
- **No mode flag, no onboarding preference** persisted — granularity is just "how many rows exist right
  now," derivable from the list itself.

### 3.2 Conditional re-add guard (manual-delete stickiness) — DECIDED (2026-06-16)

A manual delete must be sticky against the model re-resurrecting it, but must NOT block the user
genuinely re-adding it. We get both by **reusing the per-debt `source` tag the analysis already emits**
(`user_stated | inferred`) — no new LLM classification field needed:
- **Context-exclusion (primary):** `getDebtContext` (§6) omits tombstoned debts, so we never *remind*
  the model of a deleted debt → it can only reappear if the **user** raises it.
- **Tombstone gate (secondary):** in the reconcile, when an incoming debt's normalized name matches a
  **tombstoned** (`deleted_at IS NOT NULL`) row:
  - incoming `source='inferred'` → **suppress** (the model re-extracted it from vague cues; keep deleted).
  - incoming `source='user_stated'` → **lift the tombstone** (`deleted_at = NULL`, apply the update) — the
    user explicitly re-asserted it (re-incurred, or the delete was a mistake).
- **Why reuse `source` not a new field:** `user_stated` already means "the user asserted this in *this*
  message" — exactly the re-add intent. Simpler and less flaky than a bespoke `reAddIntent` boolean. If
  eval shows the `source` tag is too noisy *for tombstoned names specifically*, fall back to an explicit
  analysis field then (YAGNI until proven).
- **No suppression TTL** — the tombstone is permanent; a `user_stated` mention is the only thing that
  lifts it (so a debt genuinely re-incurred years later still works, via the user typing it).

---

## 4. `debt_total` / `debt_to_income` sync (denormalization)

These two scalars stay on the snapshot (features read them cheaply) but their inputs now live in two
places (the `debts` table + the snapshot's income). Keep them correct from **both** write paths:
- **Any debt change** (reconcile / manual CRUD / check-in balance): service recomputes
  `debt_total = debtTotalFromRows(rows)`, then `debt_to_income = income>0 ? debt_total/(income*12) : 0`
  (reading income from the snapshot), and writes both to the snapshot row.
- **Income change** (`mergeIntoSnapshot` income path): recompute `debt_to_income` from the *stored*
  `debt_total`. `deriveMetrics` stops computing `debtTotal` from an array — it treats `s.debtTotal` as a
  carried scalar and only recomputes `debtToIncome` from it.

---

## 5. #3 Part A — the `debtsCleared` signal (storage-agnostic, fixes the launch-blocker)

Give analyze an explicit way to say "the user cleared debt," distinct from silence. **This is the
launch-blocking trust fix and is independent of the table** (it would work on the old JSONB model too).

**Frame the bug correctly: this is a *structural signal gap*, not a confidence problem.** The merge
never got to apply the gate — the empty-debts array was dropped one step earlier as "no signal". Proof:
the **scalar** fields already handle an explicit zero today (e.g. "I have $0 in savings" → `numField`
accepts finite `0` → `stated` → `stated ≥ stored` overwrites → savings = 0). Only the **debts array**
breaks, because `[]` is overloaded as both "zero debts" and "debts not mentioned". So the fix adds the
missing signal; it does **not** touch the confidence ladder.

- **Schema** (`shared/schemas.ts` `FinalAnalysisSchema`): add `debtsCleared: z.boolean().optional()`.
- **Prompt** (`supabase/functions/analyze/prompt.ts`): instruct the model to set `debtsCleared: true`
  **only** when the user explicitly states all consumer debt is now gone ("paid off all my debts",
  "I'm debt-free"). A roast that simply doesn't mention debt leaves it unset.
- **Reconcile:** when `debtsCleared`, delete all non-mortgage rows (mortgage stays — "all my debts"
  colloquially means consumer debt; don't nuke a secured mortgage line). The model only flags "cleared";
  the reconcile (which knows the existing rows) does the deletion — the model needn't enumerate debts it
  can't see.
- **⚠️ Rule #1 (paid):** this touches the analyze LLM prompt. Validate with an eval run
  (`tools/eval/*`) / `manual-test.ts` before shipping — **state the call count + cost and get
  confirmation first.** Also redeploy `analyze` after the prompt change (a *changed* function deploys
  fine; the static-import gotcha only bites an *unchanged* redeploy).

### 5.1 Prompt guidance — tag on assertion-vs-inference, not precise-vs-vague (decided 2026-06-16)

The axis that matters is **assertion vs. inference**, *not* linguistic precision. Our audience speaks
casually ("paid it all off", "I make like 5k now") — that's still a **clear assertion** and must be
`source: 'user_stated'` (→ `stated`, authoritative, overwrites even a prior stated value via the `≥`
recency tie-break). Reserve `low`/`medium` for genuinely **inferred / hedged** statements ("things are
looking up", "probably around 3k expenses"). The prompt must classify on *"is the user asserting a fact
or is the model inferring one"* — colloquial phrasing alone must NOT downgrade a clear assertion. This
is the lever that gives casual-phrasing users good UX without weakening the gate. **Add explicit
worked examples** to the analyze prompt: a casual assertion → `user_stated`; a vibe-y vent → low
confidence, no overwrite.

### 5.2 Why we keep the confidence gate (rationale, so it isn't re-litigated)

We considered "accept anything the user says" (drop the gate). **Rejected** — it makes UX *worse*. The
gate's one real job is stopping an *inferred* value from clobbering *stated* data. Scenario: a user
stated income $5k last week; this week they vent "ugh I'm so broke" with no number, and the model infers
income low at `medium`. With the gate, `medium < stated` keeps the $5k (correct). Without it, a moody
numberless one-liner corrupts a solid figure — and casual users produce those constantly. The gate
already lets clear statements win (user_stated → stated → recency overwrites), so it doesn't block the
behavior we want; it only blocks the corruption we don't. **Keep the ladder; fix the signal.**

---

## 6. Roast context line (mirror `getSubscriptionContext`)
Add `getDebtContext(userId)` in the debts service — a short line summarizing known debts, injected into
the roast / re-score `freeText` (approach A, no extra prompt change), so the LLM is aware of the user's
existing debts on a re-score. Parallels `getSubscriptionContext` (`subscriptionAudit.ts:32`). Wire it
into `buildRescoreInput` (`src/services/financialSnapshot.ts`) next to the subscription line.
**Excludes tombstoned (`deleted_at IS NOT NULL`) debts** — the primary half of the §3.2 re-add guard
(don't remind the model of a debt the user just deleted).

---

## 7. Code touch-points (file-by-file)
- **`supabase/migrations/00002_debts_table.sql`** — new table + RLS + index + trigger; backfill from
  `financial_snapshots.debts`; drop the JSONB column.
- **`shared/financialSnapshot.ts`** — remove `debts` from `SnapshotPatch`/derive; `deriveMetrics` treats
  `debtTotal` as a carried scalar (recompute only `debtToIncome`); add `reconcileDebts` (incl. the §3.1
  `other`-line remainder + the §3.2 tombstone gate, both keyed off the per-debt `source`) +
  `debtTotalFromRows`; `patchFromAnalysis`/`patchFromOnboarding` stop emitting `debts`. (`SnapshotDebt`,
  `isPayoffDebt`, `DebtKind` stay — reused as the row/incoming shape.) `reconcileDebts` takes both active
  and tombstoned rows so it can decide suppress-vs-lift.
- **New `src/services/debts.ts`** (mirrors `subscriptionAudit.ts`) — `getDebts` (active only),
  `upsertDebt`, `deleteDebt` (**soft**: sets `deleted_at`), `reconcileFromAnalysis` (post-roast; may lift
  a tombstone), `applyCheckinBalances`, `getDebtContext` (active only); each mutating call recomputes
  `debt_total`/`debt_to_income` → snapshot. Dev `USE_AI_MOCKS` in-memory store like `financialSnapshot.ts`.
- **`src/services/financialSnapshot.ts`** — `updateSnapshotFromAnalysis` no longer carries debts;
  call the debts reconcile post-roast. Remove `applyDebtUpdates`/`updateSnapshotDebts` (move to debts
  service). `buildRescoreInput` adds `getDebtContext`.
- **`src/services/tables.ts`** — add `debts: 'debts'`.
- **Read sites consuming the per-debt array** → debts service: `DebtPayoffScreen`, `ResultsScreen`,
  `MonthlyCheckInScreen` (balance updates), `src/utils/checkinGoals.ts`. Scalar readers of `debt_total`
  (Dashboard, Paywall, `useNotifications`, `moneyTrend`) are **unaffected** — that column stays.
- **`supabase/functions/analyze/`** — `prompt.ts` (`debtsCleared` instruction) + `index.ts` (pass it
  through) + `shared/schemas.ts` (`debtsCleared` field).
- **`src/services/gdpr.ts`** — add `debts` to the export + account-delete sweep (mirror
  `tracked_subscriptions`).
- **Fixtures** — `mockHistory`, `sampleAnalysis`, `demoPersona`: move sample debts to the table/mock store.

---

## 8. Open questions / edge cases (resolve during build)
1. **Manual-delete stickiness — DECIDED (2026-06-16): conditional tombstone, see §3.2.** Soft-delete
   (`deleted_at`) + context-exclusion + a reconcile gate that suppresses an `inferred` re-add of a
   tombstoned name but lets a `user_stated` re-mention lift it. Reuses the existing per-debt `source`
   tag — no new LLM field.
2. **Name-collision identity.** Two debts both "Credit card" can't be told apart by the name matcher.
   Once rows have ids, manual edits use the id; the roast path still name-matches and may merge two
   same-named debts. Acceptable for v1; consider disambiguating by `kind`+name.
3. **Onboarding seed (#2 exact debt).** Onboarding inserts one `debts` row (exact →
   `source='onboarding', confidence='stated'` name 'Debt'; bracket → `estimated`). **Largely resolved by
   §3.1:** that coarse line is just the single-line form of the one list, and itemization is user-
   initiated — so a roast doesn't need to "replace" it; it adds named lines and the coarse line shrinks to
   the `other` remainder (Q5). Residual decision: whether the onboarding line is `stated` (exact) vs
   `estimated` (bracket) only affects whether a later *inferred* roast can revise the **same** line's
   balance — inserts of new named lines aren't gated regardless.
4. **`debtsCleared` granularity.** Top-level boolean handles "all cleared." Partial payoff ("paid off the
   car, still owe the card") relies on the roast re-stating remaining debts (`user_stated` → `stated`,
   overwrites). Confirm the prompt produces that.
5. **Stated-total vs itemized reconciliation (the `other` line — §3.1).**
   - **(b) Shrinking remainder bucket — DECIDED (2026-06-16).** The coarse/`other` line acts as the
     **shrinking remainder**: itemizing a named debt out of a stated total **deducts from it** rather than
     adding alongside (so `$8k total` + later "Card $5k" → `$5k card + $3k other`, not `$13k`).
     `total = sum` holds through itemization. **Bonus:** this also surfaces **user overstatement** — if a
     user states a high total and itemizes less, the leftover lives in a *visible, editable* `other` line
     they can trim/zero, instead of being silently baked into the total. Named sum ≥ stated total → no
     `other` line (never negative).
   - **(a) Stated-total signal — STILL OPEN (build-time).** How does analyze convey a **stated total**
     ("I owe about $8k total") distinct from the itemized `debts` array? Options: a new optional
     `debtTotalStated` field on the analysis, or treat a single unnamed "total" line as the signal. Decide
     during the analyze-prompt work (same PR as `debtsCleared`; rule #1 eval).

---

## 9. Test plan
- **`shared/` unit:** `reconcileDebts` — gate inferred-vs-manual, insert-new, keep-silent, clear deletes
  non-mortgage; **tombstone gate** (§3.2: inferred re-add of a tombstoned name → suppressed; `user_stated`
  re-add → tombstone lifted); **`other`-line remainder** (§3.1: stated total $8k + named $5k → $3k other;
  named ≥ total → no other line, never negative). `debtTotalFromRows` (mortgage + tombstoned excluded).
  Snapshot tests updated (debts leave the patch; `debtTotal` carried + `debtToIncome` recomputed).
- **`src/services/debts.test.ts`:** CRUD + recompute-on-write, mocking the client like
  `purchases.test.ts`.
- **#3 regression:** "paid off all my debts" with a prior $2k row → `debtsCleared` → rows cleared,
  `debt_total = 0`.
- `npx tsc --noEmit` + `npm test` green; eval/`manual-test` for the prompt (rule #1).
