import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const CACHE_KEY = '@ambroke_offline_cache';
const CACHE_EXPIRY_KEY = '@ambroke_cache_expiry';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getSupabase() {
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return null;
}

export interface OfflineCache {
  analyses: any[];
  profile: any | null;
  cachedAt: string;
}

export async function cacheUserData(userId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const [analysesResult, profileResult] = await Promise.all([
      client.from('analyses').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      client.from('profiles').select('*').eq('id', userId).single(),
    ]);

    const cache: OfflineCache = {
      analyses: analysesResult.data || [],
      profile: profileResult.data || null,
      cachedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    await AsyncStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_TTL_MS));
    return true;
  } catch {
    return false;
  }
}

export async function getCachedData(): Promise<OfflineCache | null> {
  try {
    const expiryStr = await AsyncStorage.getItem(CACHE_EXPIRY_KEY);
    if (expiryStr && Date.now() > parseInt(expiryStr)) {
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_EXPIRY_KEY);
      return null;
    }

    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    return cacheStr ? JSON.parse(cacheStr) : null;
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
  await AsyncStorage.removeItem(CACHE_EXPIRY_KEY);
}

export async function getOfflineAnalyses(): Promise<any[]> {
  const cache = await getCachedData();
  return cache?.analyses || [];
}

export async function getOfflineProfile(): Promise<any | null> {
  const cache = await getCachedData();
  return cache?.profile || null;
}
