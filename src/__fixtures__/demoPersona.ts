// The demo persona — ONE believable user climbing out of debt, Apr → Jun 2026. Single source of truth
// for every dev mock (USE_AI_MOCKS): the analysis history, getMockAnalysisById, check-ins, the money
// trend, the snapshot, the active plan, and captions all DERIVE from this timeline, so the demo never
// contradicts itself on camera. Edit the arc here — the mocks read from it. See docs/redesign/demo-prep.md.
import type { DatedFigures } from '@shared/moneyTrend';

export interface PersonaDebt {
  name: string;
  balance: number;
  apr: number; // percent (e.g. 25 = 25% APR)
}

export interface PersonaPoint {
  id: string; // analysis / check-in id — history + getMockAnalysisById key off this
  date: string; // ISO timestamp
  kind: 'roast' | 'checkin';
  score: number; // 0–100
  income: number; // monthly
  expenses: number; // monthly
  savings: number; // liquid balance
  debts: PersonaDebt[]; // itemized; debtTotal = sum of balances
  mood?: number; // check-ins only (1–5)
  note?: string; // roast headline / check-in note
}

export const PERSONA_NAME = 'Jason';
export const PERSONA_CARD = 'Capital One Credit Card'; // the high-APR card paid off mid-arc

// Apr 12 (the hole) → Jun 1 (saving). Same named debts paid DOWN — card + medical → $0, car $11.5k → $9.8k.
// Debt ↓, savings ↑, score ↑, spend ↓ all monotonic. The Jun 1 point === MOCK_SNAPSHOT / money-trend "now".
export const PERSONA_TIMELINE: PersonaPoint[] = [
  {
    id: 'mock-1', date: '2026-04-12T18:30:00Z', kind: 'roast', score: 42,
    income: 4800, expenses: 4100, savings: 200,
    debts: [
      { name: PERSONA_CARD, balance: 4200, apr: 25 },
      { name: 'Car Loan', balance: 11500, apr: 7.9 },
      { name: 'Medical Bill', balance: 800, apr: 0 },
    ],
    note: 'Paycheck to paycheck, card maxed.',
  },
  {
    id: 'mock-2', date: '2026-04-26T19:10:00Z', kind: 'roast', score: 52,
    income: 4800, expenses: 3950, savings: 700,
    debts: [
      { name: PERSONA_CARD, balance: 3300, apr: 25 },
      { name: 'Car Loan', balance: 11200, apr: 7.9 },
      { name: 'Medical Bill', balance: 800, apr: 0 },
    ],
    note: 'Cut two subscriptions, threw the difference at the card.',
  },
  {
    id: 'ci-1', date: '2026-05-03T12:00:00Z', kind: 'checkin', score: 55, mood: 3,
    income: 4800, expenses: 3900, savings: 900,
    debts: [
      { name: PERSONA_CARD, balance: 2600, apr: 25 },
      { name: 'Car Loan', balance: 11000, apr: 7.9 },
      { name: 'Medical Bill', balance: 400, apr: 0 },
    ],
    note: 'Chipping at the card. Medical bill almost gone.',
  },
  {
    id: 'mock-3', date: '2026-05-10T17:30:00Z', kind: 'roast', score: 61,
    income: 4800, expenses: 3880, savings: 1200,
    debts: [
      { name: PERSONA_CARD, balance: 1500, apr: 25 },
      { name: 'Car Loan', balance: 10800, apr: 7.9 },
    ],
    note: 'Medical bill cleared, card under $1.5k. Buffer forming.',
  },
  {
    id: 'ci-2', date: '2026-05-20T12:00:00Z', kind: 'checkin', score: 66, mood: 5,
    income: 4800, expenses: 3850, savings: 1700,
    debts: [{ name: 'Car Loan', balance: 10400, apr: 7.9 }],
    note: 'Paid off the Capital One card 🎉',
  },
  {
    id: 'mock-4', date: '2026-05-24T20:00:00Z', kind: 'roast', score: 71,
    income: 4800, expenses: 3800, savings: 2000,
    debts: [{ name: 'Car Loan', balance: 10100, apr: 7.9 }],
    note: 'Card-free. Now the surplus actually goes to savings.',
  },
  {
    id: 'mock-5', date: '2026-06-01T21:45:00Z', kind: 'roast', score: 80,
    income: 5000, expenses: 3700, savings: 2600,
    debts: [{ name: 'Car Loan', balance: 9800, apr: 7.9 }],
    note: 'Raise landed + card gone. Actually saving now.',
  },
];

export const debtTotal = (p: PersonaPoint): number => p.debts.reduce((s, d) => s + d.balance, 0);
export const cardBalance = (p: PersonaPoint): number => p.debts.find((d) => d.name === PERSONA_CARD)?.balance ?? 0;

export const personaRoasts = (): PersonaPoint[] => PERSONA_TIMELINE.filter((p) => p.kind === 'roast');
export const personaCheckins = (): PersonaPoint[] => PERSONA_TIMELINE.filter((p) => p.kind === 'checkin');

/** Most recent point — the "now" the snapshot + money-trend anchor on (Jun 1). */
export const personaLatest = (): PersonaPoint => PERSONA_TIMELINE[PERSONA_TIMELINE.length - 1];
/** First point — the plan's starting low-point (Apr 12). */
export const personaFirst = (): PersonaPoint => PERSONA_TIMELINE[0];

/** The whole timeline as money-trend readings (debt / savings / spending) for services/moneyTrend's mock. */
export const personaMoneyEvents = (): DatedFigures[] =>
  PERSONA_TIMELINE.map((p) => ({ at: p.date, debt: debtTotal(p), savings: p.savings, spending: p.expenses }));

/** Score → mood emoji (shared by history rows + analysis emotionalStatus). */
export const emojiFor = (score: number): string => {
  if (score < 40) return '😰';
  if (score < 55) return '😟';
  if (score < 68) return '😬';
  if (score < 80) return '🙂';
  return '😎';
};
