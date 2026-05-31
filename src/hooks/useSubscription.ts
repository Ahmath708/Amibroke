import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSubscription, SubscriptionTier, SubscriptionRecord, hasAccessTo, isSubscriptionPremium } from '@/services/subscriptions';
import { addCustomerInfoListener } from '@/services/purchases';

interface UseSubscriptionResult {
  tier: SubscriptionTier;
  record: SubscriptionRecord | null;
  loading: boolean;
  premium: boolean;
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

  return {
    tier,
    record,
    loading,
    premium: isSubscriptionPremium(tier),
    hasAccess: (required) => hasAccessTo(tier, required),
    refresh,
  };
}
