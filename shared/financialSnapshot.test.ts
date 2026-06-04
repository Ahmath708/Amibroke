import {
  mergeIntoSnapshot, emptySnapshot, patchFromAnalysis, patchFromOnboarding,
  fromRow, toRow, INCOME_MID, type FinancialSnapshot, type SnapshotRow,
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

describe('patchFromAnalysis', () => {
  it('maps numbers with their confidence and debts when present', () => {
    const patch = patchFromAnalysis({
      monthlyIncome: { value: 5000, confidence: 'high' },
      liquidSavings: { value: 1200, confidence: 'low' },
      debts: [{ name: 'Loan', balance: 8000, interestRate: 0.07, minimumPayment: 150 }],
    });
    expect(patch.monthlyIncome).toEqual({ value: 5000, confidence: 'high' });
    expect(patch.liquidSavings?.confidence).toBe('low');
    expect(patch.debts?.value[0]).toEqual({ name: 'Loan', balance: 8000, apr: 0.07, min_payment: 150 });
  });

  it('treats an empty debts array as no signal (omits it)', () => {
    const patch = patchFromAnalysis({ monthlyIncome: { value: 4000, confidence: 'medium' }, debts: [] });
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

  it('option B: debts the user stated → stated confidence', () => {
    const patch = patchFromAnalysis({ debts: [{ name: 'Card', balance: 3000, source: 'user_stated' }] });
    expect(patch.debts?.confidence).toBe('stated');
  });
});

describe('patchFromOnboarding', () => {
  it('uses bracket midpoints (estimated) when no exact value', () => {
    const patch = patchFromOnboarding({ incomeBracket: '4k_6k', debtBracket: '5k_15k', liquidSavingsBracket: 'none' });
    expect(patch.monthlyIncome).toEqual({ value: INCOME_MID['4k_6k'], confidence: 'estimated' });
    expect(patch.debts?.value[0].balance).toBe(10000);
    expect(patch.liquidSavings?.value).toBe(0);
  });

  it('exact income is stated and wins over the bracket', () => {
    const patch = patchFromOnboarding({ incomeBracket: '2k_4k' }, 4800);
    expect(patch.monthlyIncome).toEqual({ value: 4800, confidence: 'stated' });
  });

  it('debt bracket "none" yields an empty debts array', () => {
    const patch = patchFromOnboarding({ debtBracket: 'none' });
    expect(patch.debts?.value).toEqual([]);
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
