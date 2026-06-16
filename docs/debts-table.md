# Debts table — design & build plan (#3 + #5)

> **Status:** 🔵 planned (decided 2026-06-16). Implement in a dedicated backend session.
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
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own debts" ON debts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_debts_user ON debts(user_id);
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

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
- **Schema** (`shared/schemas.ts` `FinalAnalysisSchema`): add `debtsCleared: z.boolean().optional()`.
- **Prompt** (`supabase/functions/analyze/prompt.ts`): instruct the model to set `debtsCleared: true`
  **only** when the user explicitly states all consumer debt is now gone ("paid off all my debts",
  "I'm debt-free"). A roast that simply doesn't mention debt leaves it unset.
- **Reconcile:** when `debtsCleared`, delete all non-mortgage rows (mortgage stays — "all my debts"
  colloquially means consumer debt; don't nuke a secured mortgage line).
- **⚠️ Rule #1 (paid):** this touches the analyze LLM prompt. Validate with an eval run
  (`tools/eval/*`) / `manual-test.ts` before shipping — **state the call count + cost and get
  confirmation first.** Also redeploy `analyze` after the prompt change (a *changed* function deploys
  fine; the static-import gotcha only bites an *unchanged* redeploy).

---

## 6. Roast context line (mirror `getSubscriptionContext`)
Add `getDebtContext(userId)` in the debts service — a short line summarizing known debts, injected into
the roast / re-score `freeText` (approach A, no extra prompt change), so the LLM is aware of the user's
existing debts on a re-score. Parallels `getSubscriptionContext` (`subscriptionAudit.ts:32`). Wire it
into `buildRescoreInput` (`src/services/financialSnapshot.ts`) next to the subscription line.

---

## 7. Code touch-points (file-by-file)
- **`supabase/migrations/00002_debts_table.sql`** — new table + RLS + index + trigger; backfill from
  `financial_snapshots.debts`; drop the JSONB column.
- **`shared/financialSnapshot.ts`** — remove `debts` from `SnapshotPatch`/derive; `deriveMetrics` treats
  `debtTotal` as a carried scalar (recompute only `debtToIncome`); add `reconcileDebts` +
  `debtTotalFromRows`; `patchFromAnalysis`/`patchFromOnboarding` stop emitting `debts`. (`SnapshotDebt`,
  `isPayoffDebt`, `DebtKind` stay — reused as the row/incoming shape.)
- **New `src/services/debts.ts`** (mirrors `subscriptionAudit.ts`) — `getDebts`, `upsertDebt`,
  `deleteDebt`, `reconcileFromAnalysis` (post-roast), `applyCheckinBalances`, `getDebtContext`; each
  mutating call recomputes `debt_total`/`debt_to_income` → snapshot. Dev `USE_AI_MOCKS` in-memory store
  like `financialSnapshot.ts`.
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
1. **Manual-delete stickiness (tombstones).** If a user deletes a debt, a later inferred roast may
   re-extract it (the LLM "sees" it in free text). v1: manual CRUD is authoritative *at write time* but
   we don't tombstone — a later roast that re-mentions it re-adds it. Decide if a `deleted` tombstone /
   suppression window is needed, or accept re-add as acceptable (user can re-delete). Lean: accept for
   v1, note it.
2. **Name-collision identity.** Two debts both "Credit card" can't be told apart by the name matcher.
   Once rows have ids, manual edits use the id; the roast path still name-matches and may merge two
   same-named debts. Acceptable for v1; consider disambiguating by `kind`+name.
3. **Onboarding seed (#2 exact debt).** Instead of a synthetic snapshot line, onboarding inserts one
   `debts` row: exact → `source='onboarding', confidence='stated'` (name 'Debt'); bracket → `estimated`.
   The first roast reconciles/itemizes it (a `stated` onboarding row would gate an *inferred* roast from
   replacing it — the reconcile must allow itemization; revisit whether onboarding debt should be
   `estimated` so the roast can refine it, vs `stated`/sticky. **This is the #2-debt ⚠️ flagged in the
   redesign doc.**)
4. **`debtsCleared` granularity.** Top-level boolean handles "all cleared." Partial payoff ("paid off the
   car, still owe the card") relies on the roast re-stating remaining debts (`user_stated` → `stated`,
   overwrites). Confirm the prompt produces that.

---

## 9. Test plan
- **`shared/` unit:** `reconcileDebts` (gate inferred-vs-manual, insert-new, keep-silent, clear deletes
  non-mortgage), `debtTotalFromRows` (mortgage excluded). Snapshot tests updated (debts leave the patch;
  `debtTotal` carried + `debtToIncome` recomputed).
- **`src/services/debts.test.ts`:** CRUD + recompute-on-write, mocking the client like
  `purchases.test.ts`.
- **#3 regression:** "paid off all my debts" with a prior $2k row → `debtsCleared` → rows cleared,
  `debt_total = 0`.
- `npx tsc --noEmit` + `npm test` green; eval/`manual-test` for the prompt (rule #1).
