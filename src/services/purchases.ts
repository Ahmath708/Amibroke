import AsyncStorage from '@react-native-async-storage/async-storage';
import { PurchaseTier } from '@/types';

const TIER_KEY = '@ambroke_purchase_tier';

export function isPremium(tier: PurchaseTier): boolean {
  return tier === 'action_plan' || tier === 'deep_dive';
}

export function hasAccessTo(tier: PurchaseTier, required: 'action_plan' | 'deep_dive'): boolean {
  if (required === 'action_plan') return tier === 'action_plan' || tier === 'deep_dive';
  if (required === 'deep_dive') return tier === 'deep_dive';
  return false;
}

export async function getPurchaseTier(): Promise<PurchaseTier> {
  try {
    const val = await AsyncStorage.getItem(TIER_KEY);
    if (val === 'action_plan' || val === 'deep_dive' || val === 'free') return val as PurchaseTier;
  } catch {}
  return 'free';
}

export async function setPurchaseTier(tier: PurchaseTier): Promise<void> {
  await AsyncStorage.setItem(TIER_KEY, tier);
}
