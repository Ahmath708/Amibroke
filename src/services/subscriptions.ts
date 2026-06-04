import { getSupabase } from './supabaseClient';
import { TABLES } from './tables';
import { getCustomerInfo, tierFromCustomerInfo, isPurchasesConfigured } from './purchases';

export interface SubscriptionRecord {
  user_id: string;
  // Legacy Stripe columns, retained (nullable) for historical rows.
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: 'action_plan' | 'deep_dive' | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused' | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  // RevenueCat / store columns (added in migration 00014).
  store?: 'app_store' | 'play_store' | null;
  product_id?: string | null;
  rc_entitlement?: 'action_plan' | 'deep_dive' | null;
}

export type SubscriptionTier = 'free' | 'action_plan' | 'deep_dive';

// DEV ONLY: force full (Deep Dive) access so every feature is unlocked during
// development. Never ships — gated on __DEV__ (false in release builds). Flip to
// false to exercise real tier/trial gating + the Paywall.
const DEV_FORCE_DEEP_DIVE = __DEV__ && true;

function tierFromRecord(sub: SubscriptionRecord | null): SubscriptionTier {
  if (!sub) return 'free';
  const active = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  if (!active) return 'free';
  return sub.plan ?? 'free';
}

/**
 * Resolve the user's tier and (for UI) their renewal record.
 *
 * RevenueCat's on-device customerInfo is the source of truth for entitlement.
 * The user_subscriptions row (kept in sync by the revenuecat-webhook) provides
 * record details like renewal date/status, and is the fallback tier source
 * before RevenueCat is configured.
 */
export async function getSubscription(userId: string): Promise<{ tier: SubscriptionTier; record: SubscriptionRecord | null }> {
  if (DEV_FORCE_DEEP_DIVE) return { tier: 'deep_dive', record: null };
  // No signed-in user → no subscription to verify. Bail before querying so we
  // don't send an empty string as a UUID (Postgres 22P02) for signed-out users.
  if (!userId) return { tier: 'free', record: null };

  // Entitlement from RevenueCat (if configured).
  let rcTier: SubscriptionTier | null = null;
  if (isPurchasesConfigured()) {
    rcTier = tierFromCustomerInfo(await getCustomerInfo());
  }

  // DB mirror: record details + fallback tier.
  let record: SubscriptionRecord | null = null;
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await (client as any)
        .from(TABLES.user_subscriptions)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      record = data;
    } catch (e) {
      console.warn('[subscriptions] fetch failed:', e);
    }
  }

  return { tier: rcTier ?? tierFromRecord(record), record };
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

// ─── 3-day free access (the trial) ──────────────────────────────────────────
// The trial-window math lives in shared/ so the edge functions enforce the exact
// same rule (see supabase/functions/_shared/entitlement.ts). Re-exported here for
// the app's existing import sites.
export { TRIAL_DURATION_DAYS, getTrialStatus } from '@shared/entitlement.ts';
export type { TrialStatus } from '@shared/entitlement.ts';

/**
 * Feature-level access gate. Full access during the trial window; otherwise the
 * owned subscription tier decides. The trial-aware replacement for a bare
 * `hasAccessTo` at every gated feature.
 */
export function canAccess(
  tier: SubscriptionTier | string | null | undefined,
  required: 'action_plan' | 'deep_dive',
  trialActive: boolean,
): boolean {
  return trialActive || hasAccessTo(tier, required);
}

/**
 * App-level gate: may the user use the app's core paid surface at all (running a
 * roast, the plan, the tools)? True during the trial or with any paid plan —
 * false once the trial expires with no subscription (the hard paywall).
 */
export function canUseApp(tier: SubscriptionTier, trialActive: boolean): boolean {
  return trialActive || isSubscriptionPremium(tier);
}
