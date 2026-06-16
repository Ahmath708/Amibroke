import { Platform } from 'react-native';
import { TABLES } from './tables';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getSupabaseClient as getSupabase } from './supabaseClient';

export interface UserDataExport {
  profile: Record<string, unknown> | null;
  financialContext: Record<string, unknown>[];
  financialSnapshot: Record<string, unknown>[];
  analyses: Record<string, unknown>[];
  actionPlans: Record<string, unknown>[];
  communityPosts: Record<string, unknown>[];
  postReactions: Record<string, unknown>[];
  checkIns: Record<string, unknown>[];
  trackedSubscriptions: Record<string, unknown>[];
  planEntitlements: Record<string, unknown>[];
  debts: Record<string, unknown>[];
  spending: Record<string, unknown>[];
  exportedAt: string;
}

export async function exportUserData(userId: string): Promise<UserDataExport | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const [
      profileResult,
      contextResult,
      snapshotResult,
      analysesResult,
      plansResult,
      postsResult,
      reactionsResult,
      checkInsResult,
      subsResult,
      entitlementsResult,
      debtsResult,
      spendingResult,
    ] = await Promise.all([
      client.from(TABLES.profiles).select('*').eq('id', userId).single(),
      client.from(TABLES.financial_context).select('*').eq('user_id', userId),
      client.from(TABLES.financial_snapshots).select('*').eq('user_id', userId),
      client.from(TABLES.analyses).select('*').eq('user_id', userId),
      client.from(TABLES.action_plans).select('*').eq('user_id', userId),
      client.from(TABLES.community_posts).select('*').eq('user_id', userId),
      client.from(TABLES.post_reactions).select('*').eq('user_id', userId),
      client.from(TABLES.check_ins).select('*').eq('user_id', userId),
      client.from(TABLES.tracked_subscriptions).select('*').eq('user_id', userId),
      client.from(TABLES.plan_entitlements).select('*').eq('user_id', userId),
      (client as any).from(TABLES.debts).select('*').eq('user_id', userId),
      (client as any).from(TABLES.spending).select('*').eq('user_id', userId),
    ]);

    return {
      profile: profileResult.data,
      financialContext: contextResult.data || [],
      financialSnapshot: snapshotResult.data || [],
      analyses: analysesResult.data || [],
      actionPlans: plansResult.data || [],
      communityPosts: postsResult.data || [],
      postReactions: reactionsResult.data || [],
      checkIns: checkInsResult.data || [],
      trackedSubscriptions: subsResult.data || [],
      planEntitlements: entitlementsResult.data || [],
      debts: debtsResult.data || [],
      spending: spendingResult.data || [],
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
    // [table, owning column]. Children first; profiles is deleted last (FK cascades clean up the rest).
    const deletions: Array<[string, string]> = [
      [TABLES.post_reactions, 'user_id'],
      [TABLES.community_posts, 'user_id'],
      [TABLES.check_ins, 'user_id'],
      [TABLES.action_plans, 'user_id'],
      [TABLES.tracked_subscriptions, 'user_id'],
      [TABLES.plan_entitlements, 'user_id'],
      [TABLES.debts, 'user_id'],
      [TABLES.spending, 'user_id'],
      [TABLES.financial_snapshots, 'user_id'],
      [TABLES.financial_context, 'user_id'],
      [TABLES.analyses, 'user_id'],
    ];

    for (const [table, column] of deletions) {
      const { error } = await (client as any)
        .from(table)
        .delete()
        .eq(column, userId);

      if (error) {
        console.error(`[gdpr] delete from ${table} error:`, error);
        return { success: false, error: `Failed to delete ${table}: ${error.message}` };
      }
    }

    const { error: profileError } = await client
      .from(TABLES.profiles)
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
      .from(TABLES.profiles)
      .update({
        username: anonUsername,
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
