import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getSubscription, SubscriptionTier, SubscriptionRecord,
  canAccess, canUseApp as canUseAppFn, isSubscriptionPremium, getTrialStatus,
} from '@/services/subscriptions';
import { addCustomerInfoListener } from '@/services/purchases';

interface UseSubscriptionResult {
  tier: SubscriptionTier; // the OWNED plan (for display/manage), trial-independent
  record: SubscriptionRecord | null;
  loading: boolean;
  premium: boolean; // owns a paid plan (display) — see `canUseApp` for the gate
  /** In the 3-day free-access window. */
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
  /** May use the app's core paid surface at all (trial OR a paid plan). */
  canUseApp: boolean;
  /** Trial-aware feature gate. */
  hasAccess: (required: 'action_plan' | 'deep_dive') => boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [record, setRecord] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTier('free');
      setRecord(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getSubscription(user.id);
    setTier(result.tier);
    setRecord(result.record);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-resolve the tier whenever RevenueCat reports an entitlement change
  // (purchase, renewal, restore, expiration).
  useEffect(() => {
    return addCustomerInfoListener(() => {
      refresh();
    });
  }, [refresh]);

  // Trial derives from the (server-set) account creation time — no extra fetch.
  const trial = getTrialStatus(user?.created_at);

  return {
    tier,
    record,
    loading,
    premium: isSubscriptionPremium(tier),
    trialActive: trial.active,
    trialDaysLeft: trial.daysLeft,
    trialEndsAt: trial.endsAt,
    canUseApp: canUseAppFn(tier, trial.active),
    hasAccess: (required) => canAccess(tier, required, trial.active),
    refresh,
  };
}
