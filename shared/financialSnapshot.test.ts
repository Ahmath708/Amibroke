import {
  mergeIntoSnapshot, applyDebtUpdates, emptySnapshot, patchFromAnalysis, patchFromOnboarding,
  incomingDebtsFromAnalysis, onboardingDebtSeed, reconcileDebts, debtTotalFromRows,
  fromRow, toRow, INCOME_MID, DEBT_MID, isPayoffDebt,
  type FinancialSnapshot, type SnapshotRow, type DebtRecord,
} from './financialSnapshot';

const NOW = '2026-06-04T00:00:00.000Z';
const LATER = '2026-06-05T00:00:00.000Z';

describe('mergeIntoSnapshot — confidence rules', () => {
  it('seeds from empty and recomputes derived metrics', () => {
    const s = mergeIntoSnapshot(null, {
      monthlyIncome: { value: 5000, confidence: 'stated' },
      monthlyExpenses: { value: 3000, confidence: 'high' },
      liquidSavings: { value: 6000, confidence: 'estimated' },
    }, 'onboarding', NOW);
    expect(s.monthlyIncome?.value).toBe(5000);
    expect(s.monthlySavings).toBe(2000);          // 5000 - 3000
    expect(s.savingsRate).toBeCloseTo(0.4);        // 2000 / 5000
    expect(s.emergencyFundMonths).toBeCloseTo(2);  // 6000 / 3000
  });

  it('updates a field when incoming confidence >= stored', () => {
    const base = mergeIntoSnapshot(null, { monthlyIncome: { value: 3000, confidence: 'estimated' } }, 'onboarding', NOW);
    const next = mergeIntoSnapshot(base, { monthlyIncome: { value: 5200, confidence: 'high' } }, 'roast', LATER);
    expect(next.monthlyIncome?.value).toBe(5200);
    expect(next.monthlyIncome?.confidence).toBe('high');
  });

  it('NEVER downgrades a stated value with a lower-confidence write', () => {
    const base = mergeIntoSnapshot(null, { monthlyIncome: { value: 5200, confidence: 'stated' } }, 'manual', NOW);
    const next = mergeIntoSnapshot(base, { monthlyIncome: { value: 4000, confidence: 'medium' } }, 'roast', LATER);
    expect(next.monthlyIncome?.value).toBe(5200);       // unchanged
    expect(next.monthlyIncome?.confidence).toBe('stated');
  });

  it('keeps a field the patch is silent on (no zeroing of debts)', () => {
    const base = mergeIntoSnapshot(null, {
      debts: { value: [{ name: 'Card', balance: 5000 }], confidence: 'high' },
    }, 'roast', NOW);
    // a later roast about spending only — silent on debts
    const next = mergeIntoSnapshot(base, { monthlyExpenses: { value: 2500, confidence: 'high' } }, 'roast', LATER);
    expect(next.debts?.value).toHaveLength(1);
    expect(next.debtTotal).toBe(5000);
  });

  it('sets score only when provided', () => {
    const base = mergeIntoSnapshot(null, {}, 'roast', NOW, 72);
    expect(base.score).toBe(72);
    const next = mergeIntoSnapshot(base, {}, 'checkin', LATER); // no score arg
    expect(next.score).toBe(72);                                 // preserved
  });
});

describe('monthly savings — only when deterministically known (Finding B)', () => {
  it('savingsRate is 0 when expenses are inferred (no deterministic basis)', () => {
    const s = mergeIntoSnapshot(null, {
      monthlyIncome: { value: 5000, confidence: 'high' },
      monthlyExpenses: { value: 3000, confidence: 'low' }, // inferred from baselines
    }, 'roast', NOW);
    expect(s.monthlySavings).toBe(0);
    expect(s.savingsRate).toBe(0);
  });

  it('savingsRate is computed when income AND expenses are both known', () => {
    const s = mergeIntoSnapshot(null, {
      monthlyIncome: { value: 5000, confidence: 'stated' },
      monthlyExpenses: { value: 3000, confidence: 'stated' }, // e.g. reconciled from stated savings
    }, 'roast', NOW);
    expect(s.monthlySavings).toBe(2000);
    expect(s.savingsRate).toBeCloseTo(0.4);
  });
});

describe('patchFromAnalysis', () => {
  it('maps the scalar fields with their confidence', () => {
    const patch = patchFromAnalysis({
      monthlyIncome: { value: 5000, confidence: 'high' },
      liquidSavings: { value: 1200, confidence: 'low' },
    });
    expect(patch.monthlyIncome).toEqual({ value: 5000, confidence: 'high' });
    expect(patch.liquidSavings?.confidence).toBe('low');
  });

  it('no longer emits debts (the table reconcile owns them)', () => {
    const patch = patchFromAnalysis({ monthlyIncome: { value: 4000, confidence: 'medium' }, debts: [{ name: 'Card', balance: 3000 }] });
    expect(patch.debts).toBeUndefined();
  });

  it('option B: a user_stated number becomes stated; inferred keeps its confidence', () => {
    const patch = patchFromAnalysis({
      monthlyIncome: { value: 5200, confidence: 'low', source: 'user_stated' },
      monthlyExpenses: { value: 3000, confidence: 'high', source: 'inferred' },
    });
    expect(patch.monthlyIncome?.confidence).toBe('stated');
    expect(patch.monthlyExpenses?.confidence).toBe('high');
  });
});

describe('incomingDebtsFromAnalysis', () => {
  it('maps a roast debts[] into the reconcile incoming shape (apr/min/kind/source)', () => {
    const incoming = incomingDebtsFromAnalysis({
      debts: [{ name: 'Loan', balance: 8000, interestRate: 0.07, minimumPayment: 150, kind: 'student_loan', source: 'user_stated' }],
    });
    expect(incoming).toEqual([{ name: 'Loan', balance: 8000, apr: 0.07, min_payment: 150, kind: 'student_loan', source: 'user_stated', confidence: undefined }]);
  });

  it('returns [] when the roast lists no debts', () => {
    expect(incomingDebtsFromAnalysis({ monthlyIncome: 4000 })).toEqual([]);
    expect(incomingDebtsFromAnalysis({ debts: [] })).toEqual([]);
  });
});

describe('patchFromOnboarding', () => {
  it('uses bracket midpoints (estimated) when no exact value', () => {
    const patch = patchFromOnboarding({ incomeBracket: '4k_6k', liquidSavingsBracket: 'none' });
    expect(patch.monthlyIncome).toEqual({ value: INCOME_MID['4k_6k'], confidence: 'estimated' });
    expect(patch.liquidSavings?.value).toBe(0);
  });

  it('exact income is stated and wins over the bracket', () => {
    const patch = patchFromOnboarding({ incomeBracket: '2k_4k' }, { income: 4800 });
    expect(patch.monthlyIncome).toEqual({ value: 4800, confidence: 'stated' });
  });

  it('never emits debts (onboarding debt now seeds the table, not the snapshot patch)', () => {
    const patch = patchFromOnboarding({ incomeBracket: '4k_6k', debtBracket: '5k_15k' }, { debt: 8000 });
    expect(patch.debts).toBeUndefined();
  });

  // #1 — capture an explicit $0 (the most financially fragile users) instead of bucketing to a midpoint.
  it('exact $0 income is stated $0 (not bucketed to a bracket midpoint)', () => {
    const patch = patchFromOnboarding({ incomeBracket: 'under_2k' }, { income: 0 });
    expect(patch.monthlyIncome).toEqual({ value: 0, confidence: 'stated' });
  });

  it('a null exact falls through to the bracket (no exact entered)', () => {
    const patch = patchFromOnboarding({ incomeBracket: '2k_4k' }, { income: null });
    expect(patch.monthlyIncome).toEqual({ value: INCOME_MID['2k_4k'], confidence: 'estimated' });
  });

  // #2 — exact savings typed on the numpad screens beats the bracket midpoint.
  it('exact savings is stated and wins over the savings bracket', () => {
    const patch = patchFromOnboarding({ liquidSavingsBracket: '2k_10k' }, { savings: 4200 });
    expect(patch.liquidSavings).toEqual({ value: 4200, confidence: 'stated' });
  });

  // Expenses — onboarding can now seed a stated total expenses (numpad exact).
  it('exact expenses is stated', () => {
    const patch = patchFromOnboarding({}, { expenses: 3500 });
    expect(patch.monthlyExpenses).toEqual({ value: 3500, confidence: 'stated' });
  });

  it('omits expenses when none is given', () => {
    const patch = patchFromOnboarding({ incomeBracket: '4k_6k' });
    expect(patch.monthlyExpenses).toBeUndefined();
  });
});

describe('onboardingDebtSeed', () => {
  it('exact debt → one stated coarse row (not a midpoint)', () => {
    expect(onboardingDebtSeed({ debtBracket: '5k_15k' }, { debt: 8000 })).toEqual(
      { name: 'Debt', balance: 8000, apr: 0, min_payment: 0, kind: 'other', source: 'user_stated' },
    );
  });

  it('exact $0 debt → no row', () => {
    expect(onboardingDebtSeed({ debtBracket: 'over_50k' }, { debt: 0 })).toBeNull();
  });

  it('bracket (no exact) → an estimated coarse row at the midpoint', () => {
    const seed = onboardingDebtSeed({ debtBracket: '5k_15k' });
    expect(seed?.confidence).toBe('estimated');
    expect(seed?.balance).toBe(DEBT_MID['5k_15k']);
  });

  it('no debt info → null', () => {
    expect(onboardingDebtSeed({})).toBeNull();
    expect(onboardingDebtSeed({ debtBracket: 'none' })).toBeNull();
  });
});

describe('debt kind — mortgage exclusion (Finding A)', () => {
  it('excludes mortgages from debt_total and isPayoffDebt', () => {
    const s = mergeIntoSnapshot(null, {
      debts: { value: [
        { name: 'Mortgage', balance: 220000, apr: 0.07, kind: 'mortgage' },
        { name: 'Visa', balance: 3000, apr: 0.21, kind: 'credit_card' },
      ], confidence: 'medium' },
    }, 'roast', NOW);
    expect(s.debtTotal).toBe(3000);                                  // mortgage excluded
    const payoff = (s.debts?.value ?? []).filter(isPayoffDebt);
    expect(payoff.map((d) => d.name)).toEqual(['Visa']);
  });

  it('incomingDebtsFromAnalysis carries kind through', () => {
    const [d] = incomingDebtsFromAnalysis({ debts: [{ name: 'Car', balance: 18000, kind: 'auto' }] });
    expect(d.kind).toBe('auto');
  });

  it('debtTotalFromRows excludes mortgages and tombstoned rows', () => {
    const rows: DebtRecord[] = [
      { name: 'Mortgage', balance: 220000, kind: 'mortgage', source: 'roast', confidence: 'medium' },
      { name: 'Visa', balance: 3000, kind: 'credit_card', source: 'roast', confidence: 'medium' },
      { name: 'Old card', balance: 999, kind: 'credit_card', source: 'manual', confidence: 'stated', deletedAt: NOW },
    ];
    expect(debtTotalFromRows(rows)).toBe(3000);
  });
});

describe('reconcileDebts', () => {
  const row = (over: Partial<DebtRecord> & { name: string; balance: number }): DebtRecord =>
    ({ source: 'roast', confidence: 'medium', ...over });

  it('inserts a genuinely new debt', () => {
    const ops = reconcileDebts([], [{ name: 'Visa', balance: 3000, source: 'user_stated' }], 'roast');
    expect(ops.inserts).toHaveLength(1);
    expect(ops.inserts[0]).toMatchObject({ name: 'Visa', balance: 3000, confidence: 'stated', source: 'roast' });
    expect(ops.updates).toEqual([]);
    expect(ops.deleteIds).toEqual([]);
  });

  it('updates a matched active row when incoming confidence >= stored (by normalized name)', () => {
    const existing = [row({ id: 'a', name: 'Credit Card', balance: 3000, confidence: 'medium' })];
    const ops = reconcileDebts(existing, [{ name: 'credit card', balance: 2400, source: 'user_stated' }], 'roast');
    expect(ops.inserts).toEqual([]);
    expect(ops.updates[0]).toMatchObject({ id: 'a', balance: 2400, confidence: 'stated' });
  });

  it('does NOT let an inferred roast clobber a stated row (gate)', () => {
    const existing = [row({ id: 'a', name: 'Card', balance: 3000, confidence: 'stated' })];
    const ops = reconcileDebts(existing, [{ name: 'Card', balance: 9999, source: 'inferred', confidence: 'medium' }], 'roast');
    expect(ops.updates).toEqual([]); // blocked
    expect(ops.inserts).toEqual([]);
  });

  it('keeps a silent existing row (no op)', () => {
    const existing = [row({ id: 'a', name: 'Card', balance: 3000 })];
    const ops = reconcileDebts(existing, [], 'roast');
    expect(ops).toEqual({ inserts: [], updates: [], deleteIds: [] });
  });

  it('debtsCleared soft-deletes all non-mortgage active rows and ignores incoming', () => {
    const existing = [
      row({ id: 'a', name: 'Card', balance: 3000, kind: 'credit_card' }),
      row({ id: 'm', name: 'Mortgage', balance: 200000, kind: 'mortgage' }),
    ];
    const ops = reconcileDebts(existing, [{ name: 'Card', balance: 3000, source: 'inferred' }], 'roast', { debtsCleared: true });
    expect(ops.deleteIds).toEqual(['a']); // mortgage kept
    expect(ops.inserts).toEqual([]);
    expect(ops.updates).toEqual([]);
  });

  it('tombstone: suppresses an inferred re-add of a deleted debt', () => {
    const existing = [row({ id: 'a', name: 'Card', balance: 3000, confidence: 'stated', deletedAt: NOW })];
    const ops = reconcileDebts(existing, [{ name: 'Card', balance: 3000, source: 'inferred' }], 'roast');
    expect(ops).toEqual({ inserts: [], updates: [], deleteIds: [] }); // stays deleted
  });

  it('tombstone: a user_stated re-mention lifts it (deletedAt cleared)', () => {
    const existing = [row({ id: 'a', name: 'Card', balance: 3000, confidence: 'stated', deletedAt: NOW })];
    const ops = reconcileDebts(existing, [{ name: 'Card', balance: 1500, source: 'user_stated' }], 'roast');
    expect(ops.updates[0]).toMatchObject({ id: 'a', balance: 1500, confidence: 'stated', deletedAt: null });
  });
});

describe('applyDebtUpdates — per-debt check-in (Chunk B)', () => {
  const base = () => mergeIntoSnapshot(null, {
    debts: { value: [
      { name: 'Credit card', balance: 3000, apr: 0.21, min_payment: 90, kind: 'credit_card' },
      { name: 'Student loan', balance: 15000, apr: 0.05, kind: 'student_loan' },
    ], confidence: 'medium' },
  }, 'roast', NOW);

  it('updates a matched balance (by name), keeps APR/kind, marks stated/checkin, re-derives total', () => {
    const s = applyDebtUpdates(base(), { 'Credit card': 2400 }, 'checkin', LATER);
    const cc = s.debts!.value.find((d) => d.name === 'Credit card')!;
    expect(cc.balance).toBe(2400);
    expect(cc.apr).toBe(0.21);
    expect(cc.kind).toBe('credit_card');
    expect(s.debts!.confidence).toBe('stated');
    expect(s.debts!.source).toBe('checkin');
    expect(s.debtTotal).toBe(2400 + 15000);
  });

  it('matches case-insensitively and ignores unknown names', () => {
    const s = applyDebtUpdates(base(), { 'credit card': 1000, 'Car loan': 5000 }, 'checkin', LATER);
    expect(s.debts!.value.find((d) => d.name === 'Credit card')!.balance).toBe(1000);
    expect(s.debts!.value).toHaveLength(2); // 'Car loan' ignored — not present
  });

  it('no real change → returns the snapshot unchanged (same ref)', () => {
    const b = base();
    expect(applyDebtUpdates(b, { 'Credit card': 3000 }, 'checkin', LATER)).toBe(b); // same balance
    expect(applyDebtUpdates(b, {}, 'checkin', LATER)).toBe(b);                       // empty
  });
});

describe('row round-trip', () => {
  it('toRow → fromRow preserves provenance + values', () => {
    const snap: FinancialSnapshot = mergeIntoSnapshot(null, {
      monthlyIncome: { value: 5200, confidence: 'stated' },
      debts: { value: [{ name: 'Card', balance: 3000, apr: 0.22, min_payment: 90 }], confidence: 'high' },
    }, 'roast', NOW, 64);
    const row = toRow(snap, 'user-1') as unknown as SnapshotRow;
    const back = fromRow(row);
    expect(back.monthlyIncome).toEqual({ value: 5200, source: 'roast', confidence: 'stated', updatedAt: NOW });
    expect(back.debts?.value[0].balance).toBe(3000);
    expect(back.score).toBe(64);
    expect(back.debtTotal).toBe(3000);
  });
});
