// Money-trend IO — pulls the user's dated debt/savings/spending readings from immutable roast history
// (`analyses`, flat columns) + check-ins (`check_ins`, JSONB `metrics`), anchors at the current snapshot,
// and hands them to the pure merge. Mocked in dev (USE_AI_MOCKS) with a sample series.
import { USE_AI_MOCKS } from '@/config/ai';
import { buildMoneyTrend, type MoneyTrend, type DatedFigures } from '@shared/moneyTrend';
import { TABLES } from './tables';
import { withClient } from './supabaseClient';
import { getSnapshot } from './financialSnapshot';
import { getCheckIns } from './checkins';
import { personaMoneyEvents } from '@/__fixtures__/demoPersona';

const EMPTY_TREND: MoneyTrend = { debt: [], savings: [], spending: [] };

/**
 * The user's money trend (debt / savings / spending) over time. Merges immutable roast history +
 * check-ins (last-of-day), anchored at the current snapshot. Empty series on no data / error.
 */
export async function getMoneyTrend(userId: string): Promise<MoneyTrend> {
  if (USE_AI_MOCKS) return buildMoneyTrend(personaMoneyEvents()); // last event (Jun 1) is the endpoint

  return withClient<MoneyTrend>('fetch money trend', EMPTY_TREND, async (client) => {
    // 1. Per-roast figures — `analyses` stores them as flat columns.
    const { data: rows, error } = await (client as any)
      .from(TABLES.analyses)
      .select('created_at, debt_total, liquid_savings, monthly_expenses')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const roastFigures: DatedFigures[] = (rows || []).map((r: any) => ({
      at: r.created_at,
      debt: r.debt_total ?? null,
      savings: r.liquid_savings ?? null,
      spending: r.monthly_expenses ?? null,
    }));

    // 2. Check-in figures — folded into the JSONB `metrics` (check_ins has no flat columns).
    const checkinFigures: DatedFigures[] = (await getCheckIns(userId)).map((c) => ({
      at: c.created_at,
      debt: c.metrics?.debtTotal ?? null,
      savings: c.metrics?.liquidSavings ?? null,
      spending: c.metrics?.monthlyExpenses ?? null,
    }));

    // 3. Anchor the end at "now" — the current snapshot is the most-recent value.
    const snap = await getSnapshot(userId);
    const now: DatedFigures = {
      at: new Date().toISOString(),
      debt: snap?.debtTotal ?? null,
      savings: snap?.liquidSavings?.value ?? null,
      spending: snap?.monthlyExpenses?.value ?? null,
    };

    return buildMoneyTrend([...roastFigures, ...checkinFigures], now);
  });
}
