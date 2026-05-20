import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return null;
}

export interface UserDataExport {
  profile: Record<string, unknown> | null;
  analyses: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
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
      checkInsResult,
      postsResult,
      referralsResult,
      paymentsResult,
    ] = await Promise.all([
      client.from('profiles').select('*').eq('id', userId).single(),
      client.from('analyses').select('*').eq('user_id', userId),
      client.from('subscriptions').select('*').eq('user_id', userId),
      client.from('check_ins').select('*').eq('user_id', userId),
      client.from('community_posts').select('*').eq('user_id', userId),
      client.from('referrals').select('*').eq('referrer_id', userId),
      client.from('payments').select('*').eq('user_id', userId),
    ]);

    return {
      profile: profileResult.data,
      analyses: analysesResult.data || [],
      subscriptions: subscriptionsResult.data || [],
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

  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `am-i-broke-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function deleteUserData(userId: string): Promise<{ success: boolean; error: string | null }> {
  const client = getSupabase();
  if (!client) return { success: false, error: 'Backend not configured' };

  try {
    const tables = [
      'post_reactions',
      'community_posts',
      'check_ins',
      'subscriptions',
      'analyses',
      'referrals',
      'payments',
    ];

    for (const table of tables) {
      const { error } = await client
        .from(table)
        .delete()
        .eq('user_id', userId);

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
