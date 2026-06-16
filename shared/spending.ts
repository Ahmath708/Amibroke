// Named-spending breakdown — a PARTIAL list of the categories the user has mentioned (rent,
// takeout, …). The `spending` table is the source of truth; the user can lightly CRUD it and each
// roast merges its mentioned categories in. Framework-agnostic (app + edge functions).
//
// Deliberately simpler than debts: every item is `user_stated` (the analyze schema only emits
// categories the user named), so there's NO confidence gate and NO tombstone (a category only
// reappears when the user mentions it again — always legitimate). It is a PARTIAL breakdown:
// `sum(items)` does NOT have to equal `monthlyExpenses` (that stays the separate authoritative
// total). See docs/redesign §7 — this avoids the "force total = sum" budgeting creep.

export interface SpendingItem {
  id?: string;       // table row id (absent = a new row to insert)
  category: string;
  amount: number;
}

/** Ops the spending service applies to the table. No deletes — silence keeps a category. */
export interface SpendingOps {
  inserts: SpendingItem[]; // new rows (no id)
  updates: SpendingItem[]; // existing rows whose amount changed (id set)
}

const normCat = (c: string): string => c.trim().toLowerCase();

/**
 * Merge a roast's mentioned categories into the existing list.
 * - Match by normalized category → update when the amount changed.
 * - No match → insert.
 * - Existing categories the roast didn't mention → kept (no op — silence ≠ deletion).
 * Pure; the service applies the ops to the table. Manual delete is a separate explicit op.
 */
export function mergeSpending(existing: SpendingItem[], incoming: SpendingItem[]): SpendingOps {
  const byCat = new Map(existing.map((s) => [normCat(s.category), s]));
  const ops: SpendingOps = { inserts: [], updates: [] };
  const seen = new Set<string>();
  for (const item of incoming) {
    if (!Number.isFinite(item.amount) || item.amount < 0) continue;
    const n = normCat(item.category);
    if (seen.has(n)) continue; // dedup within one batch (last would otherwise double-insert)
    seen.add(n);
    const hit = byCat.get(n);
    if (hit) {
      if (item.amount !== hit.amount) ops.updates.push({ ...hit, amount: item.amount });
    } else {
      ops.inserts.push({ category: item.category, amount: item.amount });
    }
  }
  return ops;
}

interface AnalysisLikeSpending {
  mentionedSpending?: { category: string; amount: number }[];
}

/** Map a roast's `mentionedSpending[]` into the merge incoming shape. */
export function incomingSpendingFromAnalysis(a: AnalysisLikeSpending): SpendingItem[] {
  if (!Array.isArray(a.mentionedSpending)) return [];
  return a.mentionedSpending
    .filter((s) => s && typeof s.category === 'string' && Number.isFinite(s.amount))
    .map((s) => ({ category: s.category, amount: s.amount }));
}
