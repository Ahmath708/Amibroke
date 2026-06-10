import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TABLES } from '@/services/tables';
import { Platform } from 'react-native';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { loginPurchases, logoutPurchases } from '@/services/purchases';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getSupabaseClient } from '@/services/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Platform.OS === 'web'
  ? 'https://zefhsplmgxefmpdqbbvv.supabase.co/auth/v1/callback'
  : makeRedirectUri({ scheme: 'amibroke', path: 'auth/callback' });

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
  signUp: (email: string, password: string, username?: string) => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  needsUsername: boolean | null;
  needsOnboarding: boolean | null;
  refreshProfile: () => void;
};

// DEV ONLY: when true, forces the onboarding gate on so the flow always shows (for iterating).
// Currently OFF — gate uses the real `onboarded` flag. Re-enable (`&& true`) during the
// onboarding refinement pass. Never ships — gated on __DEV__.
const DEV_FORCE_ONBOARDING = __DEV__ && true;

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // null = not yet resolved; true/false once the profile is known.
  const [needsUsername, setNeedsUsername] = useState<boolean | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  // Single shared, session-aware client (see services/supabaseClient.ts) so every
  // service rides the same authenticated session and RLS passes.
  const supabase = getSupabaseClient() as SupabaseClient;

  // Resolve the first-run gates (username + onboarding) from the user's profile.
  const checkProfile = useCallback(async (u: User | null) => {
    if (!u) { setNeedsUsername(false); setNeedsOnboarding(false); return; }
    try {
      const { data } = await supabase.from(TABLES.profiles).select('username, onboarded').eq('id', u.id).maybeSingle();
      const row = data as { username?: string; onboarded?: boolean } | null;
      setNeedsUsername(!row?.username);
      // DEV ONLY: always show onboarding so the flow can be iterated. NOTE: finishing it
      // loops you straight back here — set this false (or remove) to get into the app.
      // Never ships (gated on __DEV__).
      setNeedsOnboarding(DEV_FORCE_ONBOARDING ? true : !row?.onboarded);
    } catch {
      setNeedsUsername(false);
      setNeedsOnboarding(false);
    }
  }, [supabase]);

  const refreshProfile = useCallback(() => checkProfile(user), [checkProfile, user]);

  useEffect(() => {
    // Keep the RevenueCat app-user-id in sync with the Supabase session so
    // purchases (and the webhook → user_subscriptions) map to the right user.
    const syncPurchasesIdentity = (u: User | null) => {
      if (u) loginPurchases(u.id).catch(() => {});
      else logoutPurchases().catch(() => {});
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      syncPurchasesIdentity(u);
      checkProfile(u).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      syncPurchasesIdentity(u);
      checkProfile(u);
    });

    return () => subscription.unsubscribe();
  }, [checkProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string, username?: string) => {
    try {
      // Availability check BEFORE creating the account — the hard gate unmounts
      // the signup form the instant a session exists, so we can't surface "taken"
      // there afterward. set_username remains the backstop for the TOCTOU race.
      if (username) {
        const { data: avail, error: availErr } = await supabase.rpc('is_username_available', { p_username: username.trim() });
        if (availErr) return { error: 'Could not verify username. Please try again.' };
        if (avail === false) return { error: 'That username is taken — try another.' };
      }

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
      if (data?.user && data.user.confirmation_sent_at && !data.user.confirmed_at) {
        return {
          error: 'Check your email to confirm your account. Please check your inbox (and spam folder) for a confirmation link.',
        };
      }
      // Session established — claim the username, then re-resolve the first-run gates.
      if (username) {
        await supabase.rpc('set_username', { p_username: username.trim().toLowerCase() });
      }
      await checkProfile(data?.user ?? null);
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
        if (result.type !== 'success' || !result.url) {
          return { error: 'Authentication was cancelled' };
        }
        // The browser returns ?code=… on success. Surface any provider error
        // (e.g. Supabase "unable to exchange external code" → Google creds issue).
        const { params, errorCode } = QueryParams.getQueryParams(result.url);
        if (errorCode || params.error) {
          return { error: params.error_description || params.error || errorCode || 'Sign-in failed.' };
        }
        const { code } = params;
        if (!code) return { error: 'No authorization code returned from provider.' };
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) return { error: exchangeError.message };
      }
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : `${provider} sign-in failed` };
    }
  };

  // iOS uses NATIVE Sign in with Apple (required by App Store Guideline 4.8 when
  // other social logins are offered). Web/Android fall back to the web-OAuth flow.
  const signInWithApple = async (): Promise<{ error?: string }> => {
    if (Platform.OS !== 'ios') return signInWithOAuthProvider('apple');
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        return signInWithOAuthProvider('apple');
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        return { error: 'Apple did not return an identity token.' };
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { error: error.message };
      return {};
    } catch (e: any) {
      // User tapped cancel on the native sheet.
      if (e?.code === 'ERR_REQUEST_CANCELED' || e?.code === 'ERR_CANCELED') {
        return { error: 'Sign in was cancelled' };
      }
      return { error: e instanceof Error ? e.message : 'Apple sign-in failed' };
    }
  };
  const signInWithGoogle = () => signInWithOAuthProvider('google');

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, supabase, signIn, signUp, signInWithApple, signInWithGoogle, signOut, needsUsername, needsOnboarding, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
