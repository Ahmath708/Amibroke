// Unified financial snapshot — the single per-user "current financial state" every feature
// reads (docs/unified-financial-model.md). Framework-agnostic (app + edge functions).
//
// Written by onboarding (estimated), each roast (confident-merge), and check-ins/manual edits.
// Each input field carries provenance so writes MERGE confidently: a field only updates when
// the incoming confidence is >= the stored one (never downgrade `stated`), and a field the
// writer is silent on is KEPT.

// ─── Confidence ladder (#1) ──────────────────────────────────────────────────
export type Confidence = 'estimated' | 'low' | 'medium' | 'high' | 'stated';
const RANK: Record<Confidence, number> = { estimated: 0, low: 1, medium: 2, high: 3, stated: 4 };

export type SnapshotSource = 'onboarding' | 'roast' | 'checkin' | 'manual';

export type DebtKind = 'credit_card' | 'student_loan' | 'auto' | 'mortgage' | 'medical' | 'personal' | 'other';

export interface SnapshotDebt {
  id?: string;
  name: string;
  balance: number;
  apr?: number;
  min_payment?: number;
  kind?: DebtKind;
}

/**
 * Debts the payoff planner + the consumer `debt_total` operate on — everything EXCEPT a
 * mortgage. A mortgage is secured, long-term debt you don't "dig out of" in a 90-day plan;
 * leaving it in swamps avalanche/snowball and balloons DTI (see Finding A, snapshot-e2e).
 */
export const isPayoffDebt = (d: SnapshotDebt): boolean => d.kind !== 'mortgage';

// One tracked input field: its value + where it came from + how sure we are.
export interface ProvField<T> {
  value: T;
  source: SnapshotSource;
  confidence: Confidence;
  updatedAt: string;
}

// The working snapshot: four provenance-tracked inputs + derived metrics features read.
export interface FinancialSnapshot {
  monthlyIncome?: ProvField<number>;
  monthlyExpenses?: ProvField<number>;
  liquidSavings?: ProvField<number>;
  debts?: ProvField<SnapshotDebt[]>;
  // derived (recomputed on every write)
  monthlySavings: number;
  savingsRate: number;
  debtTotal: number;
  emergencyFundMonths: number;
  debtToIncome: number;
  score: number | null;
  updatedAt: string;
}

const INPUT_FIELDS = ['monthlyIncome', 'monthlyExpenses', 'liquidSavings', 'debts'] as const;
type InputField = (typeof INPUT_FIELDS)[number];

// Timing-safe "is the latest roast stale?" — true if any roast-INPUT field was changed by a
// NON-roast source (check-in, manual edit, …) AFTER the given roast's created_at. The roast's own
// confident-merge (source: 'roast') is excluded, and pre-roast changes fall before the timestamp —
// so it never false-positives right after a roast, yet catches any later data change (not just
// check-ins). Returns false for an unparseable timestamp.
export function isSnapshotStaleSince(snap: FinancialSnapshot, roastCreatedAt: string): boolean {
  const since = new Date(roastCreatedAt).getTime();
  if (Number.isNaN(since)) return false;
  return INPUT_FIELDS.some((k) => {
    const f = snap[k] as ProvField<unknown> | undefined;
    return f != null && f.source !== 'roast' && new Date(f.updatedAt).getTime() > since;
  });
}

// An incoming write — only the fields the writer has signal for.
export interface SnapshotPatch {
  monthlyIncome?: { value: number; confidence: Confidence };
  monthlyExpenses?: { value: number; confidence: Confidence };
  liquidSavings?: { value: number; confidence: Confidence };
  debts?: { value: SnapshotDebt[]; confidence: Confidence };
}

export function emptySnapshot(now: string): FinancialSnapshot {
  return { monthlySavings: 0, savingsRate: 0, debtTotal: 0, emergencyFundMonths: 0, debtToIncome: 0, score: null, updatedAt: now };
}

// Recompute the derived metrics from the current input fields.
function deriveMetrics(s: FinancialSnapshot, now: string): FinancialSnapshot {
  const income = s.monthlyIncome?.value ?? 0;
  const expenses = s.monthlyExpenses?.value ?? 0;
  const liquid = s.liquidSavings?.value ?? 0;
  // Consumer debt only — a mortgage isn't "debt to pay down" in the dig-out sense (Finding A).
  const debtTotal = (s.debts?.value ?? []).filter(isPayoffDebt).reduce((sum, d) => sum + (d.balance || 0), 0);
  // Monthly savings is asserted ONLY when income AND expenses are actually KNOWN (user-stated /
  // high-confidence — expenses become 'stated' when reconciled from a stated monthly-savings
  // figure, Finding B). When expenses are merely inferred there is no deterministic way to know
  // savings, so default to 0 rather than fabricate a rate from a baseline expense guess.
  const known = (f?: ProvField<number>): boolean => !!f && (f.confidence === 'stated' || f.confidence === 'high');
  const savingsKnown = income > 0 && known(s.monthlyIncome) && known(s.monthlyExpenses);
  const monthlySavings = savingsKnown ? income - expenses : 0;
  return {
    ...s,
    monthlySavings,
    savingsRate: savingsKnown ? monthlySavings / income : 0,
    debtTotal,
    emergencyFundMonths: expenses > 0 ? liquid / expenses : 0,
    debtToIncome: income > 0 ? debtTotal / (income * 12) : 0,
    updatedAt: now,
  };
}

/**
 * Confident-merge a patch into the snapshot. For each field the patch carries, update it only
 * when the incoming confidence >= the stored one (so `stated` is never downgraded by an
 * `estimated`/`inferred` figure). Fields absent from the patch are kept. Derived metrics
 * are recomputed. `score` is set separately (it's not a confidence-tracked input).
 */
export function mergeIntoSnapshot(
  current: FinancialSnapshot | null,
  patch: SnapshotPatch,
  source: SnapshotSource,
  now: string,
  score?: number | null,
): FinancialSnapshot {
  const base = current ?? emptySnapshot(now);
  const next: FinancialSnapshot = { ...base };

  for (const key of INPUT_FIELDS) {
    const incoming = patch[key];
    if (!incoming) continue; // silent → keep what we have
    const existing = base[key] as ProvField<unknown> | undefined;
    if (!existing || RANK[incoming.confidence] >= RANK[existing.confidence]) {
      // @ts-expect-error — value type is per-field; the patch keys guarantee it matches.
      next[key] = { value: incoming.value, source, confidence: incoming.confidence, updatedAt: now };
    }
  }

  if (score !== undefined) next.score = score;
  return deriveMetrics(next, now);
}

/**
 * Update specific debts' balances from a check-in (the per-debt path, §7). Matches each update to
 * an existing snapshot debt **by name** (case-insensitive — v1; snapshot debts have no stable id
 * yet) and sets its balance, leaving APR/kind/min_payment intact. The debts field becomes
 * `stated`/the given source (the user explicitly reported these balances). Unmatched names are
 * ignored; a no-op returns the snapshot unchanged. Derived metrics recomputed.
 */
export function applyDebtUpdates(
  current: FinancialSnapshot,
  updates: Record<string, number>,
  source: SnapshotSource,
  now: string,
): FinancialSnapshot {
  const debts = current.debts?.value ?? [];
  if (debts.length === 0 || Object.keys(updates).length === 0) return current;
  const norm = (n: string) => n.trim().toLowerCase();
  const byName = new Map(Object.entries(updates).map(([n, b]) => [norm(n), b]));
  let changed = false;
  const next = debts.map((d) => {
    const nb = byName.get(norm(d.name));
    if (nb != null && Number.isFinite(nb) && nb >= 0 && nb !== d.balance) { changed = true; return { ...d, balance: nb }; }
    return d;
  });
  if (!changed) return current;
  const field: ProvField<SnapshotDebt[]> = { value: next, source, confidence: 'stated', updatedAt: now };
  return deriveMetrics({ ...current, debts: field }, now);
}

// ─── Mapping from a roast (FinalAnalysis-shaped) ─────────────────────────────
type Source = 'user_stated' | 'inferred';
interface NumberWithConfidence { value: number; confidence?: Confidence; source?: Source }
interface AnalysisDebt { name: string; balance: number; interestRate?: number; minimumPayment?: number; confidence?: Confidence; source?: Source; kind?: DebtKind }
interface AnalysisLike {
  monthlyIncome?: NumberWithConfidence | number;
  monthlyExpenses?: NumberWithConfidence | number;
  liquidSavings?: NumberWithConfidence | number;
  debts?: AnalysisDebt[];
}

const numField = (f: NumberWithConfidence | number | undefined): { value: number; confidence: Confidence } | undefined => {
  if (f == null) return undefined;
  if (typeof f === 'number') return Number.isFinite(f) ? { value: f, confidence: 'medium' } : undefined;
  if (!Number.isFinite(f.value)) return undefined;
  // Option B: an explicitly user-stated figure is `stated`; otherwise its low/medium/high.
  const confidence: Confidence = f.source === 'user_stated' ? 'stated' : (f.confidence ?? 'medium');
  return { value: f.value, confidence };
};

/**
 * A roast → snapshot patch for the SCALAR fields only. Debts are no longer merged here — they're
 * reconciled into the `debts` table (the source of truth) by `reconcileDebts` / the debts service,
 * which mirrors the result back into `snapshot.debts` + `debt_total`. See docs/debts-table.md.
 */
export function patchFromAnalysis(a: AnalysisLike): SnapshotPatch {
  const patch: SnapshotPatch = {};
  const inc = numField(a.monthlyIncome);
  const exp = numField(a.monthlyExpenses);
  const liq = numField(a.liquidSavings);
  if (inc) patch.monthlyIncome = inc;
  if (exp) patch.monthlyExpenses = exp;
  if (liq) patch.liquidSavings = liq;
  return patch;
}

/** Map a roast's `debts[]` into the `reconcileDebts` incoming shape (provenance-aware). */
export function incomingDebtsFromAnalysis(a: AnalysisLike): IncomingDebt[] {
  if (!Array.isArray(a.debts)) return [];
  return a.debts.map((d) => ({
    name: d.name,
    balance: d.balance,
    apr: d.interestRate ?? 0,
    min_payment: d.minimumPayment ?? 0,
    kind: d.kind,
    source: d.source,
    confidence: d.confidence,
  }));
}

// ─── Mapping from onboarding (income/savings/debt brackets → estimated midpoints, exact → stated) ──
// Onboarding now seeds a COARSE, `estimated` debt total (one synthetic line) so the starting score is
// debt-aware. The first roast itemizes real debts (name/balance/APR/kind) at higher confidence, and
// the confident-merge replaces this estimate.
export const INCOME_MID: Record<string, number> = { under_2k: 1500, '2k_4k': 3000, '4k_6k': 5000, '6k_10k': 8000, over_10k: 12000 };
export const SAVINGS_MID: Record<string, number> = { none: 0, under_500: 250, '500_2k': 1250, '2k_10k': 6000, '10k_50k': 30000, over_50k: 65000 };
export const DEBT_MID: Record<string, number> = { none: 0, under_5k: 2500, '5k_15k': 10000, '15k_50k': 30000, over_50k: 75000 };

/** An exact typed figure for the onboarding money fields (incl. an explicit `$0`). */
export interface OnboardingExact {
  income?: number | null;
  savings?: number | null;
  debt?: number | null;
  expenses?: number | null;
}

/**
 * Onboarding answers → snapshot patch (income + savings + debt). For each field an **exact** typed
 * figure (incl. `$0`) is `stated` and wins over the bracket; a range-chip pick is the bracket
 * midpoint at `estimated`.
 *
 * `$0` is a real, user-stated value (unemployed / no savings / no debt) — NOT "no signal" — so it
 * must land as `stated $0`, never fall through to a bracket midpoint (which would overstate exactly
 * the most financially fragile users). A null/undefined exact means "no exact entered → use the
 * bracket". Exact debt seeds one coarse `stated` line; the first roast itemizes real debts.
 */
export function patchFromOnboarding(
  ctx: { incomeBracket?: string; liquidSavingsBracket?: string; debtBracket?: string },
  exact?: OnboardingExact,
): SnapshotPatch {
  const patch: SnapshotPatch = {};
  // A typed figure counts only when it's a finite, non-negative number — crucially INCLUDING `0`.
  const stated = (v: number | null | undefined): number | undefined =>
    v != null && Number.isFinite(v) && v >= 0 ? v : undefined;

  const exIncome = stated(exact?.income);
  if (exIncome !== undefined) {
    patch.monthlyIncome = { value: exIncome, confidence: 'stated' };
  } else if (ctx.incomeBracket && ctx.incomeBracket in INCOME_MID) {
    patch.monthlyIncome = { value: INCOME_MID[ctx.incomeBracket], confidence: 'estimated' };
  }

  const exSavings = stated(exact?.savings);
  if (exSavings !== undefined) {
    patch.liquidSavings = { value: exSavings, confidence: 'stated' };
  } else if (ctx.liquidSavingsBracket && ctx.liquidSavingsBracket in SAVINGS_MID) {
    patch.liquidSavings = { value: SAVINGS_MID[ctx.liquidSavingsBracket], confidence: 'estimated' };
  }
  // Total monthly expenses, when onboarding collects it (numpad exact → `stated`). Once income AND
  // expenses are both stated, deriveMetrics starts computing monthlySavings/savingsRate right away.
  const exExpenses = stated(exact?.expenses);
  if (exExpenses !== undefined) {
    patch.monthlyExpenses = { value: exExpenses, confidence: 'stated' };
  }
  // NOTE: debt is no longer a snapshot patch field — onboarding seeds the `debts` table via
  // `onboardingDebtSeed` (below) + the debts service. Income/savings stay scalar snapshot fields.
  return patch;
}

/**
 * Onboarding answers → the single coarse debt row to seed into the `debts` table (or `null` for none).
 * Exact (incl. an explicit `$0` → no row) is `stated`; a bracket pick is the midpoint at `estimated`.
 * The first roast itemizes real debts; the table reconcile takes it from there.
 */
export function onboardingDebtSeed(
  ctx: { debtBracket?: string },
  exact?: OnboardingExact,
): IncomingDebt | null {
  const exDebt = exact?.debt != null && Number.isFinite(exact.debt) && exact.debt >= 0 ? exact.debt : undefined;
  if (exDebt !== undefined) {
    return exDebt > 0
      ? { name: 'Debt', balance: exDebt, apr: 0, min_payment: 0, kind: 'other', source: 'user_stated' }
      : null; // explicit $0 → no debt row
  }
  if (ctx.debtBracket && ctx.debtBracket in DEBT_MID) {
    const bal = DEBT_MID[ctx.debtBracket];
    return bal > 0 ? { name: 'Debt (estimated)', balance: bal, apr: 0, min_payment: 0, kind: 'other', confidence: 'estimated' } : null;
  }
  return null;
}

// ─── Debt reconcile — the `debts` table is the source of truth ───────────────
// The snapshot's `debts` field is now a denormalized MIRROR (cheap reads); per-row provenance +
// tombstones live in the table. The reconcile below is pure + framework-agnostic; the debts service
// applies the ops to the table then mirrors the active rows back (`withDebtsMirror`). See
// docs/debts-table.md §3 / §3.2.

/** A debt row as the reconcile sees it (table row shape, framework-agnostic). */
export interface DebtRecord {
  id?: string;             // table row id (absent = a new row to insert)
  name: string;
  balance: number;
  apr?: number;
  min_payment?: number;
  kind?: DebtKind;
  source: SnapshotSource;  // 'onboarding' | 'roast' | 'checkin' | 'manual'
  confidence: Confidence;
  deletedAt?: string | null; // tombstone — null/undefined = active
}

/** An incoming debt from a roast/onboarding seed (provenance hints, not yet a row). */
export interface IncomingDebt {
  name: string;
  balance: number;
  apr?: number;
  min_payment?: number;
  kind?: DebtKind;
  source?: 'user_stated' | 'inferred';
  confidence?: Confidence;
}

/** Ops the debts service applies to the table. A lift is an update with `deletedAt: null`. */
export interface DebtOps {
  inserts: DebtRecord[];  // new rows (no id)
  updates: DebtRecord[];  // existing rows to update (id set)
  deleteIds: string[];    // active row ids to soft-delete
}

const debtConfidence = (d: IncomingDebt): Confidence =>
  d.source === 'user_stated' ? 'stated' : (d.confidence ?? 'medium');
const normName = (n: string): string => n.trim().toLowerCase();

/**
 * Reconcile incoming debts (from a roast) against the user's existing rows.
 * - Active name-match → update only when incoming confidence >= stored (inferred can't clobber stated).
 * - Tombstoned name-match → lift+update only when the user explicitly re-stated it (`user_stated`);
 *   an inferred re-add is suppressed (§3.2).
 * - No match → insert (genuinely new).
 * - Silent existing rows → kept (no op — silence ≠ deletion).
 * - `debtsCleared` → clear-only: soft-delete all non-mortgage active rows, ignore incoming (§5).
 */
export function reconcileDebts(
  existing: DebtRecord[],
  incoming: IncomingDebt[],
  source: SnapshotSource,
  opts: { debtsCleared?: boolean } = {},
): DebtOps {
  const active = existing.filter((d) => d.deletedAt == null);
  if (opts.debtsCleared) {
    return { inserts: [], updates: [], deleteIds: active.filter(isPayoffDebt).map((d) => d.id).filter((id): id is string => !!id) };
  }

  const activeByName = new Map(active.map((d) => [normName(d.name), d]));
  const tombByName = new Map(existing.filter((d) => d.deletedAt != null).map((d) => [normName(d.name), d]));
  const ops: DebtOps = { inserts: [], updates: [], deleteIds: [] };

  for (const d of incoming) {
    if (!Number.isFinite(d.balance) || d.balance < 0) continue;
    const conf = debtConfidence(d);
    const n = normName(d.name);

    const hit = activeByName.get(n);
    if (hit) {
      if (RANK[conf] >= RANK[hit.confidence]) {
        ops.updates.push({ ...hit, balance: d.balance, apr: d.apr ?? hit.apr, min_payment: d.min_payment ?? hit.min_payment, kind: d.kind ?? hit.kind, source, confidence: conf });
      }
      continue; // gate blocked → keep existing
    }

    const tomb = tombByName.get(n);
    if (tomb) {
      if (d.source === 'user_stated') {
        ops.updates.push({ ...tomb, balance: d.balance, apr: d.apr ?? tomb.apr, min_payment: d.min_payment ?? tomb.min_payment, kind: d.kind ?? tomb.kind, source, confidence: conf, deletedAt: null });
      }
      continue; // inferred re-add of a deleted debt → suppressed
    }

    ops.inserts.push({ name: d.name, balance: d.balance, apr: d.apr ?? 0, min_payment: d.min_payment ?? 0, kind: d.kind, source, confidence: conf });
  }
  return ops;
}

/** Sum of non-mortgage balances among ACTIVE rows (mortgage excluded — Finding A). */
export function debtTotalFromRows(rows: DebtRecord[]): number {
  return rows.filter((d) => d.deletedAt == null && isPayoffDebt(d)).reduce((sum, d) => sum + (d.balance || 0), 0);
}

/** Map active table rows → the `SnapshotDebt[]` mirror stored on the snapshot for cheap reads. */
export function debtsToMirror(rows: DebtRecord[]): SnapshotDebt[] {
  return rows
    .filter((d) => d.deletedAt == null)
    .map((d) => ({ id: d.id, name: d.name, balance: d.balance, apr: d.apr, min_payment: d.min_payment, kind: d.kind }));
}

/** Write the active rows into the snapshot's denormalized mirror (`debts` + `debt_total`) and re-derive. */
export function withDebtsMirror(snap: FinancialSnapshot, rows: DebtRecord[], source: SnapshotSource, now: string): FinancialSnapshot {
  const field: ProvField<SnapshotDebt[]> = { value: debtsToMirror(rows), source, confidence: 'stated', updatedAt: now };
  return deriveMetrics({ ...snap, debts: field }, now);
}

// ─── DB row <-> working snapshot ─────────────────────────────────────────────
// The row stores flat metric columns (+ a `debts` array) for cheap reads, and a `provenance`
// JSONB holding per-field {source, confidence, updatedAt}. Values live in the columns.
export interface SnapshotRow {
  user_id: string;
  monthly_income: number | null;
  monthly_expenses: number | null;
  monthly_savings: number | null;
  liquid_savings: number | null;
  debt_total: number | null;
  savings_rate: number | null;
  emergency_fund_months: number | null;
  debt_to_income: number | null;
  score: number | null;
  debts: SnapshotDebt[] | null;
  provenance: Record<string, { source: SnapshotSource; confidence: Confidence; updatedAt: string }> | null;
  updated_at: string;
}

const provField = <T>(value: T | null | undefined, meta: SnapshotRow['provenance'], key: InputField): ProvField<T> | undefined => {
  const m = meta?.[key];
  if (value == null || !m) return undefined;
  return { value, source: m.source, confidence: m.confidence, updatedAt: m.updatedAt };
};

export function fromRow(row: SnapshotRow): FinancialSnapshot {
  return {
    monthlyIncome: provField(row.monthly_income, row.provenance, 'monthlyIncome'),
    monthlyExpenses: provField(row.monthly_expenses, row.provenance, 'monthlyExpenses'),
    liquidSavings: provField(row.liquid_savings, row.provenance, 'liquidSavings'),
    debts: provField(row.debts ?? [], row.provenance, 'debts'),
    monthlySavings: row.monthly_savings ?? 0,
    savingsRate: row.savings_rate ?? 0,
    debtTotal: row.debt_total ?? 0,
    emergencyFundMonths: row.emergency_fund_months ?? 0,
    debtToIncome: row.debt_to_income ?? 0,
    score: row.score,
    updatedAt: row.updated_at,
  };
}

export function toRow(s: FinancialSnapshot, userId: string): SnapshotRow {
  const meta: SnapshotRow['provenance'] = {};
  for (const key of INPUT_FIELDS) {
    const f = s[key] as ProvField<unknown> | undefined;
    if (f) meta![key] = { source: f.source, confidence: f.confidence, updatedAt: f.updatedAt };
  }
  return {
    user_id: userId,
    monthly_income: s.monthlyIncome?.value ?? null,
    monthly_expenses: s.monthlyExpenses?.value ?? null,
    monthly_savings: s.monthlySavings,
    liquid_savings: s.liquidSavings?.value ?? null,
    debt_total: s.debtTotal,
    savings_rate: s.savingsRate,
    emergency_fund_months: s.emergencyFundMonths,
    debt_to_income: s.debtToIncome,
    score: s.score,
    debts: s.debts?.value ?? [],
    provenance: meta,
    updated_at: s.updatedAt,
  };
}
