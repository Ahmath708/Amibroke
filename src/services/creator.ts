import { getSupabaseClient as getSupabase } from './supabaseClient';
import { totalReactions } from '@/utils/reactions';

export interface CreatorSubmission {
  id: string;
  creator_id: string;
  user_input: string;
  score: number;
  score_label: string;
  roast: string;
  created_at: string;
}

export interface CreatorStats {
  totalRoasts: number;
  totalViews: number;
  totalShares: number;
  totalEarnings: number;
  topRoast: CreatorSubmission | null;
  recentSubmissions: CreatorSubmission[];
}

export async function generateReferralCode(userId: string): Promise<string> {
  const code = `BROKE-${userId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const client = getSupabase();
  if (client) {
    try {
      await client.from('referrals').insert({
        referrer_id: userId,
        code,
        status: 'active',
      });
    } catch {
      // ignore
    }
  }

  return code;
}

export async function getCreatorStats(userId: string): Promise<CreatorStats | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data: posts } = await client
      .from('community_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const totalRoasts = posts?.length || 0;
    const totalViews = posts?.reduce((sum, p) => sum + totalReactions(p.reactions) * 10, 0) || 0;
    const totalShares = posts?.reduce((sum, p) => sum + totalReactions(p.reactions), 0) || 0;

    const { data: referrals } = await client
      .from('referrals')
      .select('payout_amount')
      .eq('referrer_id', userId);

    const totalEarnings = referrals?.reduce((sum, r) => sum + (r.payout_amount || 0), 0) || 0;

    return {
      totalRoasts,
      totalViews,
      totalShares,
      totalEarnings,
      topRoast: posts?.[0] || null,
      recentSubmissions: (posts?.slice(0, 10) || []).map((p) => ({
        id: p.id,
        creator_id: p.user_id,
        user_input: '',
        score: p.score,
        score_label: p.score_label,
        roast: p.roast,
        created_at: p.created_at,
      })),
    };
  } catch {
    return null;
  }
}

export async function getReferralCode(userId: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data } = await client
      .from('referrals')
      .select('code')
      .eq('referrer_id', userId)
      .eq('status', 'active')
      .single();

    return data?.code || null;
  } catch {
    return null;
  }
}

export async function applyReferralCode(code: string, referredId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { data: referral } = await client
      .from('referrals')
      .select('id, referrer_id')
      .eq('code', code)
      .eq('status', 'active')
      .single();

    if (!referral) return false;

    await client.from('referrals').update({
      referred_id: referredId,
      status: 'converted',
    }).eq('id', referral.id);

    return true;
  } catch {
    return false;
  }
}

export async function batchRoast(inputs: string[], tone: string): Promise<any[]> {
  const client = getSupabase();
  if (!client) return [];

  const results: any[] = [];

  for (const input of inputs) {
    try {
      const { data, error } = await client.functions.invoke('analyze', {
        body: { userInput: input, tone },
      });

      if (error) {
        results.push({ error: error.message, input });
      } else {
        results.push(data);
      }
    } catch (e) {
      results.push({ error: e instanceof Error ? e.message : 'Unknown error', input });
    }
  }

  return results;
}

export async function submitAudienceRoast(creatorId: string, userInput: string, tone: string): Promise<any | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.functions.invoke('analyze', {
      body: { userInput, tone },
    });

    if (error) return null;

    return data;
  } catch {
    return null;
  }
}
