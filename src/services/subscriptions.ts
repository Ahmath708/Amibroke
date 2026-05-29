import { getSupabase } from './claudeApi';
import type { PostgrestError } from '@supabase/supabase-js';

export interface SubscriptionRecord {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: 'action_plan' | 'deep_dive' | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused' | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
}

export type SubscriptionTier = 'free' | 'action_plan' | 'deep_dive';

function tierFromRecord(sub: SubscriptionRecord | null): SubscriptionTier {
  if (!sub) return 'free';
  const active = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  if (!active) return 'free';
  return sub.plan ?? 'free';
}

export async function getSubscription(userId: string): Promise<{ tier: SubscriptionTier; record: SubscriptionRecord | null }> {
  const client = getSupabase();
  if (!client) return { tier: 'free', record: null };
  try {
    const { data, error } = await (client as any)
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return { tier: tierFromRecord(data), record: data };
  } catch (e) {
    console.warn('[subscriptions] fetch failed:', e);
    return { tier: 'free', record: null };
  }
}

export async function createCheckoutSession(plan: 'action_plan' | 'deep_dive'): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke('create-checkout-session', {
      body: { plan },
    });
    if (error || !data?.url) {
      console.warn('[subscriptions] createCheckoutSession error:', error, data);
      return null;
    }
    return data.url as string;
  } catch (e) {
    console.warn('[subscriptions] createCheckoutSession exception:', e);
    return null;
  }
}

export async function createPortalSession(): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke('create-portal-session');
    if (error || !data?.url) {
      console.warn('[subscriptions] createPortalSession error:', error, data);
      return null;
    }
    return data.url as string;
  } catch (e) {
    console.warn('[subscriptions] createPortalSession exception:', e);
    return null;
  }
}

export function isActive(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export function hasAccessTo(tierOrStatus: SubscriptionTier | string | null | undefined, required: 'action_plan' | 'deep_dive'): boolean {
  if (!tierOrStatus) return false;
  if (required === 'action_plan') return tierOrStatus === 'action_plan' || tierOrStatus === 'deep_dive';
  if (required === 'deep_dive') return tierOrStatus === 'deep_dive';
  return false;
}

export function isSubscriptionPremium(tier: SubscriptionTier): boolean {
  return tier === 'action_plan' || tier === 'deep_dive';
}
