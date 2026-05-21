import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Platform.OS === 'web'
  ? 'https://zefhsplmgxefmpdqbbvv.supabase.co/auth/v1/callback'
  : makeRedirectUri();

const supabaseStorage = Platform.OS === 'web'
  ? undefined
  : {
      getItem: async (key: string) => {
        try { return await AsyncStorage.getItem(key); } catch { return null; }
      },
      setItem: async (key: string, value: string) => {
        try { await AsyncStorage.setItem(key, value); } catch {}
      },
      removeItem: async (key: string) => {
        try { await AsyncStorage.removeItem(key); } catch {}
      },
    };

let pendingRedirect: { to: string; params?: any } | null = null;
export function setPendingRedirect(to: string, params?: any) { pendingRedirect = { to, params }; }
export function consumePendingRedirect() {
  const r = pendingRedirect;
  pendingRedirect = null;
  return r;
}
export function getPendingRedirect() { return pendingRedirect; }

type AuthContextType = {
  user: User | null;
  loading: boolean;
  supabase: SupabaseClient;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: supabaseStorage,
    },
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        // Handle specific Supabase error cases
        if (error.message.includes('User already registered')) {
          return { error: 'An account with this email already exists. Please try logging in.' };
        }
        if (error.message.includes('invalid email')) {
          return { error: 'Please enter a valid email address.' };
        }
        if (error.message.includes('Password should be at least 6 characters')) {
          return { error: 'Password must be at least 6 characters long.' };
        }
        return { error: error.message };
      }
      // If signUp succeeds but email confirmation is required
      if (data?.user) {
        // Check if email confirmation is required
        if (data.user.confirmation_sent_at && !data.user.confirmed_at) {
          return { 
            error: 'Check your email to confirm your account. Please check your inbox (and spam folder) for a confirmation link.' 
          };
        }
      }
      return {}; // No error
    } catch (err) {
      console.error('Sign up error:', err);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const signInWithOAuthProvider = async (provider: 'google' | 'apple'): Promise<{ error?: string }> => {
    try {
      if (Platform.OS === 'web') {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
        });
        if (error) return { error: error.message };
        // Supabase client normally redirects automatically, but just in case:
        if (data?.url && typeof window !== 'undefined') {
          window.location.href = data.url;
        }
        return {};
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: error.message };
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') return { error: 'Authentication was cancelled' };
      }
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : `${provider} sign-in failed` };
    }
  };

  const signInWithApple = () => signInWithOAuthProvider('apple');
  const signInWithGoogle = () => signInWithOAuthProvider('google');

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, supabase, signIn, signUp, signInWithApple, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
