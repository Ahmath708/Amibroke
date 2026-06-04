import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The single, session-aware Supabase client for the whole app.
 *
 * Previously AuthContext and each service created their OWN client. Only
 * AuthContext's carried the auth session, so every service write/read ran
 * anonymously and failed RLS (`auth.uid()` was null → 42501). This module is
 * the one authenticated client everything shares.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Persist the session in AsyncStorage on native; the web build uses the default
// (localStorage / URL detection).
const storage = Platform.OS === 'web'
  ? undefined
  : {
      getItem: async (key: string) => {
        try { return await AsyncStorage.getItem(key); } catch { return null; }
      },
      setItem: async (key: string, value: string) => {
        try { await AsyncStorage.setItem(key, value); } catch { /* ignore */ }
      },
      removeItem: async (key: string) => {
        try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
      },
    };

let client: SupabaseClient | null = null;

/** The shared authenticated client, or null if Supabase env vars are missing. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!client && supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        storage,
      },
    });
  }
  return client;
}

// Tests can inject a mock client; otherwise the data services use the shared
// authenticated client above. Kept here so there's one injection point every
// data module (ai, analyses, profile, community, …) shares.
let testClient: SupabaseClient | null = null;

export function __setSupabaseForTests(c: SupabaseClient | null) {
  testClient = c;
}

/** The client the data services use — the injected test mock if set, else the shared client. */
export function getSupabase(): SupabaseClient | null {
  return testClient ?? getSupabaseClient();
}

/**
 * Run a Supabase query with the standard guard + try/catch the data services
 * all repeated by hand: returns `fallback` if the client is unavailable, runs
 * `fn` otherwise, and returns `fallback` (logging `[db] <label> failed`) if it
 * throws. Collapses the ~20 copies of that boilerplate into one place.
 */
export async function withClient<T>(
  label: string,
  fallback: T,
  fn: (client: SupabaseClient) => Promise<T>,
): Promise<T> {
  const client = getSupabase();
  if (!client) return fallback;
  try {
    return await fn(client);
  } catch (e) {
    console.warn(`[db] ${label} failed:`, e);
    return fallback;
  }
}
