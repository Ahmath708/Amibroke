import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getSupabaseClient as getSupabase } from './supabaseClient';

export interface UserDataExport {
  profile: Record<string, unknown> | null;
  analyses: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  userSubscriptions: Record<string, unknown>[];
  checkIns: Record<string, unknown>[];
  communityPosts: Record<string, unknown>[];
  referrals: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  exportedAt: string;
}

export async function exportUserData(userId: string): Promise<UserDataExport | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const [
      profileResult,
      analysesResult,
      subscriptionsResult,
      userSubscriptionsResult,
      checkInsResult,
      postsResult,
      referralsResult,
      paymentsResult,
    ] = await Promise.all([
      client.from('profiles').select('*').eq('id', userId).single(),
      client.from('analyses').select('*').eq('user_id', userId),
      client.from('subscriptions').select('*').eq('user_id', userId),
      client.from('user_subscriptions').select('*').eq('user_id', userId),
      client.from('check_ins').select('*').eq('user_id', userId),
      client.from('community_posts').select('*').eq('user_id', userId),
      client.from('referrals').select('*').eq('referrer_id', userId),
      client.from('payments').select('*').eq('user_id', userId),
    ]);

    return {
      profile: profileResult.data,
      analyses: analysesResult.data || [],
      subscriptions: subscriptionsResult.data || [],
      userSubscriptions: userSubscriptionsResult.data || [],
      checkIns: checkInsResult.data || [],
      communityPosts: postsResult.data || [],
      referrals: referralsResult.data || [],
      payments: paymentsResult.data || [],
      exportedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[gdpr] exportUserData error:', error);
    return null;
  }
}

export async function downloadUserData(userId: string): Promise<boolean> {
  const data = await exportUserData(userId);
  if (!data) return false;

  const json = JSON.stringify(data, null, 2);
  const filename = `am-i-broke-data-export-${new Date().toISOString().split('T')[0]}.json`;

  // Web: trigger a browser download via the DOM.
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Native (iOS/Android): write to a file and open the share sheet.
  try {
    const uri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(uri, json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json' });
    }
    return true;
  } catch (e) {
    console.error('[gdpr] downloadUserData error:', e);
    return false;
  }
}

export async function deleteUserData(userId: string): Promise<{ success: boolean; error: string | null }> {
  const client = getSupabase();
  if (!client) return { success: false, error: 'Backend not configured' };

  try {
    // [table, owning column] — referrals is keyed by referrer_id, not user_id.
    const deletions: Array<[string, string]> = [
      ['post_reactions', 'user_id'],
      ['community_posts', 'user_id'],
      ['check_ins', 'user_id'],
      ['subscriptions', 'user_id'],
      ['user_subscriptions', 'user_id'],
      ['analyses', 'user_id'],
      ['referrals', 'referrer_id'],
      ['payments', 'user_id'],
    ];

    for (const [table, column] of deletions) {
      const { error } = await client
        .from(table)
        .delete()
        .eq(column, userId);

      if (error) {
        console.error(`[gdpr] delete from ${table} error:`, error);
        return { success: false, error: `Failed to delete ${table}: ${error.message}` };
      }
    }

    const { error: profileError } = await client
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      return { success: false, error: `Failed to delete profile: ${profileError.message}` };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function anonymizeUserData(userId: string): Promise<{ success: boolean; error: string | null }> {
  const client = getSupabase();
  if (!client) return { success: false, error: 'Backend not configured' };

  try {
    const anonUsername = `anon_${Date.now()}`;
    const { error } = await client
      .from('profiles')
      .update({
        username: anonUsername,
        display_name: 'Anonymous User',
        avatar_url: null,
      })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
