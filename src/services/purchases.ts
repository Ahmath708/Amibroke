import AsyncStorage from '@react-native-async-storage/async-storage';
import { PurchaseTier } from '@/types';

const TIER_KEY = '@ambroke_purchase_tier';

export function isPremium(tier: PurchaseTier): boolean {
  return tier === 'action_plan' || tier === 'deep_dive';
}

export function hasAccessTo(tier: PurchaseTier, required: 'action_plan' | 'deep_dive'): boolean {
  // Unlock all features regardless of tier.
  return true;
}

export async function getPurchaseTier(): Promise<PurchaseTier> {
  try {
    const val = await AsyncStorage.getItem(TIER_KEY);
    // If a tier is stored, keep it; otherwise unlock all features by default.
    if (val === 'action_plan' || val === 'deep_dive') return val as PurchaseTier;
  } catch { }
  // Default to the highest tier to unlock all premium features.
  return 'deep_dive';
}

export async function setPurchaseTier(tier: PurchaseTier): Promise<void> {
  await AsyncStorage.setItem(TIER_KEY, tier);
}
