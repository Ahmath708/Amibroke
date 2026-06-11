import { getSupabaseClient as getSupabase } from './supabaseClient';
import { TABLES } from './tables';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { analyzeFinancialSituation } from './ai';
import { RoastTone } from '@/types';

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

// PARKED (schema-v2): the `referrals` table was deferred (not migrated) along with the creator
// feature, which is flag-gated off (FEATURES.CREATOR_DASHBOARD). These referral fns degrade to
// no-ops/empties so the module compiles; restore the DB writes when the table + payout system land.
export async function generateReferralCode(userId: string): Promise<string> {
  return `BROKE-${userId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function getCreatorStats(userId: string): Promise<CreatorStats | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data: posts } = await client
      .from(TABLES.community_posts)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const totalRoasts = posts?.length || 0;
    const submissions: CreatorSubmission[] = (posts?.slice(0, 10) || []).map((p) => ({
      id: p.id,
      creator_id: p.user_id,
      user_input: '',
      score: p.score,
      score_label: getScoreBand(p.score).label, // derived (community_posts.score_label dropped)
      roast: p.roast,
      created_at: p.created_at,
    }));

    return {
      totalRoasts,
      totalViews: 0,    // PARKED: was a reactions×10 vanity proxy; reactions moved to post_reactions (schema-v2)
      totalShares: 0,   // PARKED: ditto
      totalEarnings: 0, // PARKED: no referrals/payout table
      topRoast: submissions[0] || null,
      recentSubmissions: submissions,
    };
  } catch {
    return null;
  }
}

export async function getReferralCode(_userId: string): Promise<string | null> {
  return null; // PARKED: no referrals table in schema-v2
}

export async function applyReferralCode(_code: string, _referredId: string): Promise<boolean> {
  return false; // PARKED: no referrals table in schema-v2
}

// Both delegate to the shared analyze pipeline (ai.ts) rather than re-invoking the
// edge function directly — the edge fn requires { freeText, userContext, tone },
// not { userInput }, so the old direct calls 400'd. analyzeFinancialSituation
// builds the correct body (and applies input cleaning + retries + validation).
export async function batchRoast(inputs: string[], tone: string): Promise<any[]> {
  const results: any[] = [];
  for (const input of inputs) {
    try {
      results.push(await analyzeFinancialSituation(input, tone as RoastTone));
    } catch (e) {
      results.push({ error: e instanceof Error ? e.message : 'Unknown error', input });
    }
  }
  return results;
}

export async function submitAudienceRoast(creatorId: string, userInput: string, tone: string): Promise<any | null> {
  try {
    return await analyzeFinancialSituation(userInput, tone as RoastTone);
  } catch {
    return null;
  }
}
