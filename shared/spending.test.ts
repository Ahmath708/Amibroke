import { mergeSpending, incomingSpendingFromAnalysis, type SpendingItem } from './spending';

describe('mergeSpending', () => {
  const existing: SpendingItem[] = [
    { id: 'a', category: 'Rent', amount: 1800 },
    { id: 'b', category: 'Takeout', amount: 300 },
  ];

  it('inserts a genuinely new category', () => {
    const ops = mergeSpending(existing, [{ category: 'Gym', amount: 40 }]);
    expect(ops.inserts).toEqual([{ category: 'Gym', amount: 40 }]);
    expect(ops.updates).toEqual([]);
  });

  it('updates a matched category (by normalized name) when the amount changed', () => {
    const ops = mergeSpending(existing, [{ category: 'takeout', amount: 250 }]);
    expect(ops.inserts).toEqual([]);
    expect(ops.updates).toEqual([{ id: 'b', category: 'Takeout', amount: 250 }]);
  });

  it('no-ops a matched category at the same amount', () => {
    const ops = mergeSpending(existing, [{ category: 'Rent', amount: 1800 }]);
    expect(ops).toEqual({ inserts: [], updates: [] });
  });

  it('keeps silent categories (a roast that mentions nothing → no op)', () => {
    expect(mergeSpending(existing, [])).toEqual({ inserts: [], updates: [] });
  });

  it('dedups a category repeated within one batch (first wins)', () => {
    const ops = mergeSpending([], [{ category: 'Coffee', amount: 60 }, { category: 'coffee', amount: 90 }]);
    expect(ops.inserts).toEqual([{ category: 'Coffee', amount: 60 }]);
  });

  it('skips non-finite / negative amounts', () => {
    const ops = mergeSpending([], [{ category: 'Bad', amount: NaN }, { category: 'Neg', amount: -5 }]);
    expect(ops).toEqual({ inserts: [], updates: [] });
  });
});

describe('incomingSpendingFromAnalysis', () => {
  it('maps mentionedSpending → {category, amount}, dropping malformed entries', () => {
    const incoming = incomingSpendingFromAnalysis({
      mentionedSpending: [
        { category: 'Rent', amount: 1800 },
        { category: 'Bad', amount: Number.NaN },
      ],
    });
    expect(incoming).toEqual([{ category: 'Rent', amount: 1800 }]);
  });

  it('returns [] when there is no mentionedSpending', () => {
    expect(incomingSpendingFromAnalysis({})).toEqual([]);
  });
});
