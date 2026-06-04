// Subscription-audit entries — the user's MANUAL list of recurring expenses for
// the Subscription Audit tool (Supabase `subscriptions` table). This is unrelated
// to billing / paid tiers — see services/subscriptions.ts for that.
import { Subscription } from '@/types';
import { TABLES } from './tables';
import { withClient } from './supabaseClient';

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  return withClient('fetch subscriptions', [], async (client) => {
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
  });
}

export async function saveSubscription(userId: string, sub: Omit<Subscription, 'id'>): Promise<string | null> {
  return withClient('save subscription', null, async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.subscriptions)
      .insert({ user_id: userId, ...sub })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  });
}

export async function deleteSubscription(userId: string, subId: string): Promise<boolean> {
  return withClient('delete subscription', false, async (client) => {
    const { error } = await (client as any)
      .from(TABLES.subscriptions)
      .delete()
      .eq('id', subId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  });
}
