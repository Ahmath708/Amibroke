import { applyPatch, type RevisionStep, type RevisionPatch } from './planRevision';

const step = (id: string, over: Partial<RevisionStep> = {}): RevisionStep => ({
  id, status: 'pending', week: 'Wk', title: 't', description: 'd', category: 'savings', impact: 'i', confidence: 'medium', ...over,
});
const emptyPatch = (over: Partial<RevisionPatch> = {}): RevisionPatch => ({ keep: [], drop: [], modify: [], add: [], overallMessage: 'm', ...over });

const fourPending = (): RevisionStep[] => [
  step('s0', { target: { kind: 'build_efund' } }),
  step('s1', { category: 'debt', target: { kind: 'debt_paydown' } }),
  step('s2', { target: { kind: 'cut_spend' } }),
  step('s3', { category: 'mindset', target: { kind: 'habit' } }),
];

describe('applyPatch repair engine', () => {
  it('folds a duplicate singular-kind ADD into the existing step (id preserved, content adopted)', () => {
    const cur = fourPending();
    const patch = emptyPatch({
      keep: ['s0', 's1', 's2', 's3'],
      add: [step('x', { category: 'debt', title: '$300/mo attack', target: { kind: 'debt_paydown' } }) as any],
    });
    const { steps, modelIssues, repairs } = applyPatch(cur, patch);
    const debt = steps.filter((s) => s.target?.kind === 'debt_paydown');
    expect(debt).toHaveLength(1);
    expect(debt[0].id).toBe('s1');                 // identity preserved
    expect(debt[0].title).toBe('$300/mo attack');  // new content adopted
    expect(modelIssues.some((i) => i.includes("duplicate 'debt_paydown'"))).toBe(true);
    expect(repairs.some((r) => r.includes('folded'))).toBe(true);
  });

  it('trims to <=6 by removing excess added steps first', () => {
    const { steps, repairs } = applyPatch(fourPending(), emptyPatch({
      keep: ['s0', 's1', 's2', 's3'],
      add: [step('a', { target: { kind: 'grow_income' } }) as any, step('b', { category: 'mindset', target: { kind: 'habit' } }) as any, step('c', { target: { kind: 'cut_spend' } }) as any],
    }));
    expect(steps.length).toBe(6);
    expect(repairs.some((r) => r.includes('trimmed'))).toBe(true);
  });

  it('resolves a keep+modify overlap by precedence (modify wins, applied once)', () => {
    const { steps, modelIssues } = applyPatch(fourPending(), emptyPatch({
      keep: ['s0', 's1', 's2', 's3'],
      modify: [{ id: 's1', title: 'changed' }],
    }));
    expect(steps.filter((s) => s.id === 's1')).toHaveLength(1);
    expect(steps.find((s) => s.id === 's1')!.title).toBe('changed');
    expect(modelIssues.some((i) => i.includes('op-sets'))).toBe(true);
  });

  it('never drops a completed step', () => {
    const cur = [step('s0', { status: 'done', category: 'debt', target: { kind: 'debt_paydown' } }), ...fourPending().slice(1)];
    const { steps, repairs } = applyPatch(cur, emptyPatch({ keep: ['s1', 's2', 's3'], drop: ['s0'] }));
    expect(steps.find((s) => s.id === 's0')?.status).toBe('done');
    expect(repairs.some((r) => r.includes('kept completed'))).toBe(true);
  });

  it('snapshot guard: will NOT drop the last debt step while debt is still owed', () => {
    const { steps, repairs, modelIssues } = applyPatch(
      fourPending(),
      emptyPatch({ keep: ['s0', 's2', 's3'], drop: ['s1'] }),   // model drops the only debt step
      { snapshot: { debtTotal: 5000 } },                         // …but debt is still $5k
    );
    expect(steps.some((s) => s.target?.kind === 'debt_paydown')).toBe(true); // kept
    expect(modelIssues.some((i) => i.includes('snapshot debt'))).toBe(true);
    expect(repairs.some((r) => r.includes('still shows debt'))).toBe(true);
  });

  it('allows dropping the debt step when debt is actually cleared', () => {
    const { steps } = applyPatch(
      fourPending(),
      emptyPatch({ keep: ['s0', 's2', 's3'], drop: ['s1'], add: [step('n', { target: { kind: 'grow_income' } }) as any] }),
      { snapshot: { debtTotal: 0 } },
    );
    expect(steps.some((s) => s.target?.kind === 'debt_paydown')).toBe(false);
  });
});
