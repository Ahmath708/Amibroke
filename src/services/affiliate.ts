import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const AFFILIATE_KEY = '@ambroke_affiliate_clicks';

function getSupabase() {
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return null;
}

export interface AffiliateProduct {
  id: string;
  name: string;
  category: 'savings' | 'investing' | 'cards' | 'tools' | 'insurance';
  description: string;
  icon: string;
  affiliateUrl: string;
  commission: number;
  featured?: boolean;
}

export const AFFILIATE_PRODUCTS: AffiliateProduct[] = [
  { id: '1', name: 'High-Yield Savings', category: 'savings', description: 'Earn 5% APY on your emergency fund', icon: '🏦', affiliateUrl: 'https://example.com/savings', commission: 0.05 },
  { id: '2', name: 'Robinhood Investing', category: 'investing', description: 'Start investing with $0 commission', icon: '📈', affiliateUrl: 'https://example.com/investing', commission: 0.10 },
  { id: '3', name: 'Balance Transfer Card', category: 'cards', description: '0% APR for 18 months on balance transfers', icon: '💳', affiliateUrl: 'https://example.com/cards', commission: 0.15 },
  { id: '4', name: 'YNAB Budget Tool', category: 'tools', description: 'Take control of every dollar', icon: '📊', affiliateUrl: 'https://example.com/ynab', commission: 0.20 },
  { id: '5', name: 'Renters Insurance', category: 'insurance', description: 'Protect your stuff for $15/month', icon: '🛡️', affiliateUrl: 'https://example.com/insurance', commission: 0.08 },
];

export interface AffiliateClick {
  productId: string;
  clickedAt: string;
  converted: boolean;
}

export async function trackAffiliateClick(productId: string): Promise<void> {
  const client = getSupabase();

  try {
    const clicksStr = await AsyncStorage.getItem(AFFILIATE_KEY);
    const clicks: AffiliateClick[] = clicksStr ? JSON.parse(clicksStr) : [];
    clicks.push({ productId, clickedAt: new Date().toISOString(), converted: false });
    await AsyncStorage.setItem(AFFILIATE_KEY, JSON.stringify(clicks));
  } catch {
    // ignore
  }

  if (client) {
    try {
      await client.from('affiliate_clicks').insert({
        product_id: productId,
        clicked_at: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }
}

export async function getAffiliateClicks(): Promise<AffiliateClick[]> {
  try {
    const clicksStr = await AsyncStorage.getItem(AFFILIATE_KEY);
    return clicksStr ? JSON.parse(clicksStr) : [];
  } catch {
    return [];
  }
}

export async function getProductsByCategory(category?: string): Promise<AffiliateProduct[]> {
  if (!category) return AFFILIATE_PRODUCTS;
  return AFFILIATE_PRODUCTS.filter((p) => p.category === category);
}

export function getFeaturedProducts(): AffiliateProduct[] {
  return AFFILIATE_PRODUCTS.filter((p) => p.featured);
}
