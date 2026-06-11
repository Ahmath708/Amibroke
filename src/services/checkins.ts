// Monthly check-ins — save/list a user's periodic check-in entries and read/write
// their check-in config (pinned goals + schedule anchor, stored on `profiles`).
// Mocked in dev via @/config/ai.
import { CheckIn, CheckinConfig, EMPTY_CHECKIN_CONFIG } from '@/types';
import { TABLES } from './tables';
import { USE_AI_MOCKS } from '@/config/ai';
import { withClient } from './supabaseClient';

export async function saveCheckIn(userId: string, data: {
  mood: number;
  notes?: string;
  income?: number;
  expenses?: number;
  savings?: number;
  debt?: number;
  metrics?: Record<string, number>;
  reflection?: string;  // the Haiku "coach's note" for this check-in (00023)
}): Promise<string | null> {
  if (USE_AI_MOCKS) return 'mock-checkin-id';
  // JSONB-only (schema-v2): fold the headline figures into `metrics` under their MetricKey — the
  // check_ins table has no flat income/expenses/savings/debt columns (the snapshot keeps current state).
  const { income, expenses, savings, debt, metrics, mood, notes, reflection } = data;
  const merged: Record<string, number> = { ...(metrics ?? {}) };
  if (income != null) merged.monthlyIncome = income;
  if (expenses != null) merged.monthlyExpenses = expenses;
  if (savings != null) merged.liquidSavings = savings;
  if (debt != null) merged.debtTotal = debt;
  return withClient('save check-in', null, async (client) => {
    const { data: result, error } = await (client as any)
      .from(TABLES.check_ins)
      .insert({ user_id: userId, mood, notes, reflection, metrics: merged })
      .select('id')
      .single();
    if (error) throw error;
    return result.id;
  });
}

export async function getCheckIns(userId: string): Promise<CheckIn[]> {
  if (USE_AI_MOCKS) {
    const { MOCK_CHECKINS } = require('@/__fixtures__/mockHistory');
    return MOCK_CHECKINS;
  }
  return withClient('fetch check-ins', [], async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.check_ins)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((c: any) => ({
      id: c.id,
      mood: c.mood,
      notes: c.notes,
      created_at: c.created_at,
      metrics: c.metrics ?? null,
      reflection: c.reflection ?? null,
    }));
  });
}

/** Read the user's monthly check-in config (pinned goals + schedule anchor). */
export async function getCheckinConfig(userId: string): Promise<CheckinConfig> {
  if (USE_AI_MOCKS) {
    const { MOCK_CHECKIN_CONFIG } = require('@/__fixtures__/mockHistory');
    return MOCK_CHECKIN_CONFIG;
  }
  return withClient('fetch check-in config', EMPTY_CHECKIN_CONFIG, async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.profiles)
      .select('checkin_config')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.checkin_config as CheckinConfig) ?? EMPTY_CHECKIN_CONFIG;
  });
}

export async function saveCheckinConfig(userId: string, config: CheckinConfig): Promise<boolean> {
  if (USE_AI_MOCKS) return true;
  return withClient('save check-in config', false, async (client) => {
    const { error } = await (client as any)
      .from(TABLES.profiles)
      .update({ checkin_config: config })
      .eq('id', userId);
    if (error) throw error;
    return true;
  });
}
