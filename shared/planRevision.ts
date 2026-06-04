// Plan revision — deterministic apply + repair engine (Active Plan, Model B / Phase 2).
// Cross-runtime (app + edge): NO framework imports. The LLM proposes a PATCH against
// the current steps; this code DISPOSES — it records the model's structural defects,
// then guarantees a valid, identity-preserving 4-6 step plan. See docs/active-plan-design.md
// §7. Validated/stress-tested via tools/revise-plan-demo.ts (2026-06-04).

export type StepKind = 'debt_paydown' | 'build_efund' | 'cut_spend' | 'grow_income' | 'habit';

// Singular kinds: at most one ACTIVE step each. NOTE: in production key debt_paydown by
// account (debt_paydown + which debt) so two *different* debts aren't wrongly folded —
// the compound-debt stress case showed singular-by-kind alone over-folds. For now there's
// one debt in scope, so kind is the key.
export const SINGULAR_KINDS: ReadonlySet<StepKind> = new Set<StepKind>(['build_efund', 'debt_paydown']);

export type StepStatus = 'done' | 'pending' | 'skipped';

export interface RevisionStep {
  id: string;
  status: StepStatus;
  week: string;
  title: string;
  description: string;
  category: string;
  impact: string;
  confidence: string;
  target?: { kind?: StepKind; amount?: number };
}

export interface RevisionPatch {
  keep: string[];
  drop: string[];
  modify: (Partial<RevisionStep> & { id: string })[];
  add: Omit<RevisionStep, 'id' | 'status'>[];
  overallMessage: string;
}

export interface ApplyResult<T extends RevisionStep = RevisionStep> {
  steps: T[];
  modelIssues: string[];
  repairs: string[];
}

export interface ApplyOpts {
  /** Latest financial snapshot — used for reality-checks the LLM can't be trusted with
   *  (e.g. don't let free text drop the debt step while debt still exists). */
  snapshot?: { debtTotal?: number | null } | null;
}

const kindOf = (s: RevisionStep): StepKind | undefined => s.target?.kind;
const isActiveDebt = (s: RevisionStep) => s.status !== 'done' && kindOf(s) === 'debt_paydown';

export function applyPatch<T extends RevisionStep>(current: T[], patch: RevisionPatch, opts: ApplyOpts = {}): ApplyResult<T> {
  const modelIssues: string[] = [];
  const repairs: string[] = [];
  const byId = new Map(current.map((s) => [s.id, s]));
  const inKeep = new Set(patch.keep ?? []);
  const inDrop = new Set(patch.drop ?? []);
  const modById = new Map((patch.modify ?? []).map((m) => [m.id, m]));

  // Record raw model defects (informational — we absorb them).
  for (const id of [...inKeep, ...inDrop, ...modById.keys()]) if (!byId.has(id)) modelIssues.push(`hallucinated id ${id}`);
  for (const s of current) {
    const n = (inKeep.has(s.id) ? 1 : 0) + (inDrop.has(s.id) ? 1 : 0) + (modById.has(s.id) ? 1 : 0);
    if (n === 0) modelIssues.push(`unclassified ${s.id}`);
    if (n > 1) modelIssues.push(`${s.id} in ${n} op-sets`);
  }
  for (const id of inDrop) if (byId.get(id)?.status === 'done') modelIssues.push(`tried to drop completed ${id}`);

  // Snapshot reality-check: if debt still exists, the model may NOT drop the last
  // debt_paydown step (the contradiction stress case: free text claimed "paid off",
  // snapshot still showed debt). Veto such drops.
  const debtStillOwed = (opts.snapshot?.debtTotal ?? 0) > 0;
  if (debtStillOwed) {
    const keptDebt = current.some((s) => isActiveDebt(s) && !inDrop.has(s.id));
    if (!keptDebt) {
      const victim = current.find((s) => isActiveDebt(s) && inDrop.has(s.id));
      if (victim) {
        inDrop.delete(victim.id);
        inKeep.add(victim.id);
        modelIssues.push(`tried to drop debt step ${victim.id} while snapshot debt > 0`);
        repairs.push(`kept debt step ${victim.id} — snapshot still shows debt of $${opts.snapshot?.debtTotal} (text may have overstated progress)`);
      }
    }
  }

  // Classify each CURRENT step by precedence: modify > keep > drop.
  const retained: T[] = [];
  for (const s of current) {
    const mod = modById.get(s.id);
    if (mod) { const { id: _omit, ...fields } = mod; retained.push({ ...s, ...fields }); }
    else if (inKeep.has(s.id)) retained.push(s);
    else if (inDrop.has(s.id)) {
      if (s.status === 'done') { retained.push(s); repairs.push(`kept completed ${s.id} the model dropped`); }
    } else { retained.push(s); repairs.push(`kept unclassified ${s.id}`); }
  }
  if (modelIssues.some((i) => i.includes('op-sets'))) repairs.push('resolved op-set overlap by precedence modify>keep>drop');

  let next = current.length;
  const added = (patch.add ?? []).map((a) => ({ ...a, id: `s${next++}`, status: 'pending' as StepStatus } as unknown as T));
  let result: T[] = [...retained, ...added];

  // Trim to <=6: drop excess ADDED first, then trailing pending; never completed.
  if (result.length > 6) {
    const removable = Math.min(result.length - 6, added.length);
    if (removable > 0) { result = [...retained, ...added.slice(0, added.length - removable)]; repairs.push(`trimmed ${removable} excess added step(s) to cap at 6`); }
    while (result.length > 6) {
      const fromEnd = [...result].reverse().findIndex((s) => s.status !== 'done');
      if (fromEnd === -1) break;
      const idx = result.length - 1 - fromEnd;
      repairs.push(`trimmed pending step ${result[idx].id} to cap at 6`);
      result.splice(idx, 1);
    }
  }
  // Backfill to >=4: restore dropped steps.
  if (result.length < 4) {
    const have = new Set(result.map((s) => s.id));
    for (const id of inDrop) {
      if (result.length >= 4) break;
      const s = byId.get(id);
      if (s && !have.has(id)) { result.push(s); have.add(id); repairs.push(`restored dropped ${id} to reach 4`); }
    }
  }

  // De-dup singular kinds: a VARIATION added instead of an in-place modify gets folded —
  // keep the existing step's id+status, adopt the later content (recover the intended modify).
  const firstByKind = new Map<StepKind, number>();
  const folded: T[] = [];
  for (const s of result) {
    const k = kindOf(s);
    if (s.status !== 'done' && k && SINGULAR_KINDS.has(k) && firstByKind.has(k)) {
      const i = firstByKind.get(k)!;
      const keeper = folded[i];
      folded[i] = { ...keeper, week: s.week, title: s.title, description: s.description, impact: s.impact, category: s.category, confidence: s.confidence, target: s.target ?? keeper.target };
      modelIssues.push(`duplicate '${k}' intent: ${s.id} should have been a modify of ${keeper.id}`);
      repairs.push(`folded duplicate '${k}' step ${s.id} into ${keeper.id} (recovered the intended modify)`);
      continue;
    }
    if (s.status !== 'done' && k && SINGULAR_KINDS.has(k)) firstByKind.set(k, folded.length);
    folded.push(s);
  }

  return { steps: folded, modelIssues, repairs };
}
