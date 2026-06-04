// Monthly check-ins — save/list a user's periodic check-in entries and read/write
// their check-in config (pinned goals + schedule anchor, stored on `profiles`).
// Mocked in dev via @/config/ai.
import { CheckIn, CheckinConfig, EMPTY_CHECKIN_CONFIG } from '@/types';
import { getSupabase } from './supabaseClient';

export async function saveCheckIn(userId: string, data: {
  mood: number;
  notes?: string;
  income?: number;
  expenses?: number;
  savings?: number;
  debt?: number;
  metrics?: Record<string, number>;
}): Promise<string | null> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) return 'mock-checkin-id';
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data: result, error } = await (client as any)
      .from('check_ins')
      .insert({ user_id: userId, ...data })
      .select('id')
      .single();
    if (error) throw error;
    return result.id;
  } catch (error) {
    console.warn('Failed to save check-in:', error);
    return null;
  }
}

export async function getCheckIns(userId: string): Promise<CheckIn[]> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { MOCK_CHECKINS } = require('@/__fixtures__/mockHistory');
    return MOCK_CHECKINS;
  }
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await (client as any)
      .from('check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((c: any) => ({
      id: c.id,
      mood: c.mood,
      notes: c.notes,
      income: c.income ? parseFloat(c.income) : null,
      expenses: c.expenses ? parseFloat(c.expenses) : null,
      savings: c.savings ? parseFloat(c.savings) : null,
      debt: c.debt ? parseFloat(c.debt) : null,
      created_at: c.created_at,
      metrics: c.metrics ?? null,
    }));
  } catch (error) {
    console.warn('Failed to fetch check-ins:', error);
    return [];
  }
}

/** Read the user's monthly check-in config (pinned goals + schedule anchor). */
export async function getCheckinConfig(userId: string): Promise<CheckinConfig> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { MOCK_CHECKIN_CONFIG } = require('@/__fixtures__/mockHistory');
    return MOCK_CHECKIN_CONFIG;
  }
  const client = getSupabase();
  if (!client) return EMPTY_CHECKIN_CONFIG;
  try {
    const { data, error } = await (client as any)
      .from('profiles')
      .select('checkin_config')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.checkin_config as CheckinConfig) ?? EMPTY_CHECKIN_CONFIG;
  } catch (error) {
    console.warn('Failed to fetch check-in config:', error);
    return EMPTY_CHECKIN_CONFIG;
  }
}

export async function saveCheckinConfig(userId: string, config: CheckinConfig): Promise<boolean> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) return true;
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('profiles')
      .update({ checkin_config: config })
      .eq('id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to save check-in config:', error);
    return false;
  }
}
