import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PurchaseTier } from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const TIER_KEY = '@ambroke_purchase_tier';
const RECEIPT_KEY = '@ambroke_purchase_receipt';

function getSupabase() {
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return null;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export interface PurchaseRecord {
  id: string;
  user_id: string;
  product_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export async function createPaymentIntent(
  userId: string,
  productId: 'action_plan' | 'deep_dive',
): Promise<PaymentIntentResult | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.functions.invoke('create-payment-intent', {
      body: { userId, productId },
    });

    if (error) {
      console.error('[stripe] createPaymentIntent error:', error);
      return null;
    }

    return {
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
    };
  } catch (e) {
    console.error('[stripe] createPaymentIntent exception:', e);
    return null;
  }
}

export async function confirmPurchase(
  paymentIntentId: string,
  productId: 'action_plan' | 'deep_dive',
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { data, error } = await client.functions.invoke('confirm-purchase', {
      body: { paymentIntentId, productId },
    });

    if (error) {
      console.error('[stripe] confirmPurchase error:', error);
      return false;
    }

    if (data?.success) {
      const tier = productId === 'deep_dive' ? 'deep_dive' : 'action_plan';
      await AsyncStorage.setItem(TIER_KEY, tier);
      await AsyncStorage.setItem(RECEIPT_KEY, JSON.stringify(data.receipt));
      return true;
    }

    return false;
  } catch (e) {
    console.error('[stripe] confirmPurchase exception:', e);
    return false;
  }
}

export async function verifyPurchaseServerSide(paymentIntentId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { data, error } = await client.functions.invoke('verify-purchase', {
      body: { paymentIntentId },
    });

    if (error) return false;
    return data?.verified || false;
  } catch {
    return false;
  }
}

export async function getPurchaseHistory(userId: string): Promise<PurchaseRecord[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function getPurchaseTier(): Promise<PurchaseTier> {
  try {
    const val = await AsyncStorage.getItem(TIER_KEY);
    if (val === 'action_plan' || val === 'deep_dive') return val;
  } catch { }
  return 'free';
}

export async function setPurchaseTier(tier: PurchaseTier): Promise<void> {
  await AsyncStorage.setItem(TIER_KEY, tier);
}

export function isPremium(tier: PurchaseTier): boolean {
  return tier === 'action_plan' || tier === 'deep_dive';
}

export function hasAccessTo(tier: PurchaseTier, required: 'action_plan' | 'deep_dive'): boolean {
  if (required === 'action_plan') return tier === 'action_plan' || tier === 'deep_dive';
  if (required === 'deep_dive') return tier === 'deep_dive';
  return false;
}

export async function getPurchaseReceipt(): Promise<Record<string, unknown> | null> {
  try {
    const val = await AsyncStorage.getItem(RECEIPT_KEY);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}
