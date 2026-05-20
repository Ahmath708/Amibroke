import { useState, useEffect, useCallback } from 'react';
import { PurchaseTier } from '@/types';
import { getPurchaseTier, setPurchaseTier, hasAccessTo } from '@/services/purchases';

interface UsePremiumResult {
  tier: PurchaseTier;
  loading: boolean;
  isPremium: boolean;
  hasAccess: (required: 'action_plan' | 'deep_dive') => boolean;
  setTier: (tier: PurchaseTier) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePremium(): UsePremiumResult {
  const [tier, setTierState] = useState<PurchaseTier>('free');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const t = await getPurchaseTier();
    setTierState(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setTier = useCallback(async (newTier: PurchaseTier) => {
    await setPurchaseTier(newTier);
    setTierState(newTier);
  }, []);

  return {
    tier,
    loading,
    isPremium: tier === 'action_plan' || tier === 'deep_dive',
    hasAccess: (required) => hasAccessTo(tier, required),
    setTier,
    refresh,
  };
}
