// Subscription-audit entries — the user's MANUAL list of recurring expenses for
// the Subscription Audit tool (Supabase `subscriptions` table). This is unrelated
// to billing / paid tiers — see services/subscriptions.ts for that.
import { Subscription } from '@/types';
import { TABLES } from './tables';
import { getSupabase } from './supabaseClient';

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await (client as any)
      .from(TABLES.subscriptions)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      amount: parseFloat(s.amount),
      icon: s.icon || '💸',
      category: s.category || '',
      last_used: s.last_used || '',
    }));
  } catch (error) {
    console.warn('Failed to fetch subscriptions:', error);
    return [];
  }
}

export async function saveSubscription(userId: string, sub: Omit<Subscription, 'id'>): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await (client as any)
      .from(TABLES.subscriptions)
      .insert({ user_id: userId, ...sub })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.warn('Failed to save subscription:', error);
    return null;
  }
}

export async function deleteSubscription(userId: string, subId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from(TABLES.subscriptions)
      .delete()
      .eq('id', subId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to delete subscription:', error);
    return false;
  }
}
