import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { FinalAnalysisSchema, ActionPlanResponseSchema, CaptionResponseSchema } from '@shared/schemas';
import { FinalAnalysis, ActionPlanStep, CaptionResponse, ActionPlanResponse, UserContext } from '@shared/types';
import { RoastTone, AnalysisHistoryItem, CommunityPost, Subscription, CheckIn, CheckinConfig, EMPTY_CHECKIN_CONFIG } from '@/types';

// Tests can inject a mock client; otherwise use the shared authenticated client.
let testClient: SupabaseClient | null = null;

export function __setSupabaseForTests(client: SupabaseClient | null) {
  testClient = client;
}

export function getSupabase() {
  return testClient ?? getSupabaseClient();
}

export function isFinancialAnalysis(x: unknown): x is FinalAnalysis {
  return FinalAnalysisSchema.safeParse(x).success;
}

function cleanUserInput(input: string): string {
  return input
    .replace(/\blike\s+(\d+)\s*(k|grand|thousand)?/gi, (match, num, unit) => {
      if (unit?.toLowerCase() === 'k' || unit?.toLowerCase() === 'grand' || unit?.toLowerCase() === 'thousand') {
        return `${parseInt(num) * 1000}`;
      }
      return match;
    })
    .replace(/\bidk\b/gi, 'I don\'t know')
    .replace(/\bbroke\b/gi, 'little money')
    .replace(/\bprolly\b/gi, 'probably')
    .replace(/\bgonna\b/gi, 'going to')
    .replace(/\bwanna\b/gi, 'want to')
    .replace(/\bgotta\b/gi, 'have got to')
    .replace(/\bcuz\b/gi, 'because')
    .trim();
}

const DEFAULT_USER_CONTEXT: UserContext = {
  state: 'unknown',
  ageBracket: 'unknown',
  incomeBracket: 'unknown',
  livingSituation: 'unknown',
  employmentStatus: 'unknown',
  debtBracket: 'none',
  liquidSavingsBracket: 'under_500',
};

export async function analyzeFinancialSituation(
  userInput: string,
  tone: RoastTone = 'savage',
  signal?: AbortSignal,
  retries = 2,
  userContext?: Partial<UserContext>,
): Promise<FinalAnalysis> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { SAMPLE_ANALYSIS } = require('../__fixtures__/sampleAnalysis');
    await new Promise((r) => setTimeout(r, 600));
    return SAMPLE_ANALYSIS;
  }
  console.log('[analyze] Starting analysis', { userInputLength: userInput.length, tone });
  const cleaned = cleanUserInput(userInput);
  console.log('[analyze] Cleaned input:', cleaned.substring(0, 100) + (cleaned.length > 100 ? '...' : ''));
  const client = getSupabase();
  if (!client) {
    console.error('[analyze] FATAL: supabase client not available. EXPO_PUBLIC_SUPABASE_URL set?', !!process.env.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_ANON_KEY set?', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    throw new Error('Backend not configured. Check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log('[analyze] Invoking analyze function, attempt:', attempt + 1);
      const { data, error } = await client.functions.invoke('analyze', {
        body: {
          freeText: cleaned,
          tone,
          userContext: { ...DEFAULT_USER_CONTEXT, ...(userContext ?? {}) },
        },
        signal,
      });

      if (error) {
        console.error('[analyze] invoke error — message:', error.message);

        let stage = 'unknown';
        let detail = error.message;

        try {
          const errData = error.context ? await (error.context as any).json() : null;
          if (errData) {
            console.error('[analyze] Error detail:', JSON.stringify(errData));
            stage = errData.stage || stage;
            detail = errData.error || errData.message || detail;
          }
        } catch {
          const ctx = error.context as any;
          if (ctx?.stage) stage = ctx.stage;
          if (ctx?.rawResponse) detail = ctx.rawResponse.slice(0, 300);
        }

        lastError = new Error(`Analysis failed at stage "${stage}": ${detail}`);
        if (attempt < retries) {
          console.log(`[analyze] Retrying in ${attempt + 1}s...`);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      console.log('[analyze] Received data from edge function, validating...');
      if (!isFinancialAnalysis(data)) {
        const issues = FinalAnalysisSchema.safeParse(data).error?.issues ?? [];
        console.error('[analyze] type validation FAILED — errors:', JSON.stringify(issues));
        console.error('[analyze] type validation FAILED — received shape:', JSON.stringify(data).slice(0, 600));
        lastError = new Error(`Analysis returned unexpected data format: ${issues.map(i => i.path.join('.') + ': ' + i.message).join('; ')}`);
        if (attempt < retries) {
          console.log(`[analyze] Retrying after validation failure...`);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      console.log('[analyze] Analysis successful, returning data');
      return data as FinalAnalysis;
    } catch (e) {
      console.error('[analyze] Caught exception in attempt', attempt + 1, ':', e);
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[analyze] Request aborted');
        throw e;
      }
      lastError = e instanceof Error ? e : new Error('Unknown error');
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  console.error('[analyze] All retries exhausted, throwing last error:', lastError);
  throw lastError || new Error('Analysis failed after retries');
}

export async function saveAnalysis(userId: string, input: string, analysis: FinalAnalysis): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  console.log('[analyze] Saving analysis to database for user:', userId);
  try {
    const { data, error } = await (client as any).from('analyses').insert({
      user_id: userId,
      input_text: input,
      score: analysis.score,
      score_label: analysis.scoreLabel,
      score_color: analysis.scoreColor,
      summary: analysis.summary,
      roast: analysis.roast,
      monthly_income: analysis.monthlyIncome?.value ?? analysis.monthlyIncome,
      monthly_expenses: analysis.monthlyExpenses?.value ?? analysis.monthlyExpenses,
      monthly_savings: analysis.monthlySavings,
      debt_total: analysis.debtTotal,
      savings_rate: analysis.savingsRate,
      emergency_fund_months: analysis.emergencyFundMonths,
      debt_to_income_ratio: analysis.debtToIncomeRatio,
      liquid_savings: analysis.liquidSavings?.value,
      monthly_debt_service: analysis.monthlyDebtService,
      avg_confidence: analysis.avgConfidence,
      debts: analysis.debts,
      insights: analysis.insights,
      cfpb_responses: analysis.cfpb_responses,
      score_modifier: analysis.scoreModifier,
      score_modifier_reason: analysis.scoreModifierReason,
      top_problems: analysis.topProblems,
      positive_behaviors: analysis.positiveBehaviors,
      top_fix: analysis.topFix,
      emotional_status: analysis.emotionalStatus,
      mentioned_spending: analysis.mentionedSpending,
    }).select('id').single();

    if (error) {
      console.error('[analyze] Database save error:', error.message, error.details);
      throw error;
    }
    console.log('[analyze] Analysis saved successfully, ID:', data.id);
    return data.id;
  } catch (error) {
    console.warn('Failed to save analysis:', error);
    return null;
  }
}

// Dedupe concurrent action-plan requests for the same analysis so repeated taps
// (or two screens opening at once) don't both call the paid LLM and double-write.
const actionPlanInFlight = new Map<string, Promise<ActionPlanResponse | null>>();

export function fetchOrGenerateActionPlan(
  analysis: FinalAnalysis,
  tone: RoastTone,
  analysisId?: string,
): Promise<ActionPlanResponse | null> {
  if (!analysisId) return runActionPlan(analysis, tone, analysisId);
  const existing = actionPlanInFlight.get(analysisId);
  if (existing) return existing;
  const p = runActionPlan(analysis, tone, analysisId).finally(() => actionPlanInFlight.delete(analysisId));
  actionPlanInFlight.set(analysisId, p);
  return p;
}

async function runActionPlan(
  analysis: FinalAnalysis,
  tone: RoastTone,
  analysisId?: string,
): Promise<ActionPlanResponse | null> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { SAMPLE_ACTION_PLAN } = require('../__fixtures__/sampleAnalysis');
    await new Promise((r) => setTimeout(r, 600));
    return SAMPLE_ACTION_PLAN;
  }
  const client = getSupabase();
  if (!client) return null;

  try {
    if (analysisId) {
      const { data: row } = await (client as any)
        .from('analyses')
        .select('action_plan')
        .eq('id', analysisId)
        .single();

      const plan = row?.action_plan;
      if (plan && typeof plan === 'object' && plan.overallMessage && Array.isArray(plan.steps) && plan.steps.length > 0) {
        const parsed = ActionPlanResponseSchema.safeParse(plan);
        if (parsed.success) return parsed.data;
      }
    }

    const { data, error } = await client.functions.invoke('action-plan', {
      body: { analysis, tone },
    });

    if (error) {
      console.error('[claudeApi] fetchOrGenerateActionPlan error:', error);
      return null;
    }

    const parsed = ActionPlanResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('[claudeApi] fetchOrGenerateActionPlan malformed response');
      return null;
    }

    if (analysisId) {
      await (client as any)
        .from('analyses')
        .update({ action_plan: parsed.data })
        .eq('id', analysisId);
    }

    return parsed.data;
  } catch (e) {
    console.error('[claudeApi] fetchOrGenerateActionPlan exception:', e);
    return null;
  }
}

export async function getAnalysisHistory(userId: string): Promise<AnalysisHistoryItem[]> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { MOCK_HISTORY } = require('@/__fixtures__/mockHistory');
    return MOCK_HISTORY;
  }
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await (client as any)
      .from('analyses')
      .select('id, score, score_label, summary, created_at, emotional_status, action_plan, share_captions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      score: row.score,
      score_label: row.score_label,
      summary: row.summary,
      created_at: row.created_at,
      emotional_status: row.emotional_status,
      has_action_plan: !!(row.action_plan && (Array.isArray(row.action_plan) ? row.action_plan.length > 0 : true)),
      has_captions: !!row.share_captions,
    }));
  } catch (error) {
    console.warn('Failed to fetch history:', error);
    return [];
  }
}

export async function getProfile(userId: string): Promise<any> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await (client as any)
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('Failed to fetch profile:', error);
    return null;
  }
}

export async function updateProfile(userId: string, updates: { username?: string; display_name?: string; avatar_url?: string }): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('profiles')
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to update profile:', error);
    return false;
  }
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) {
    console.warn('[uploadAvatar] Supabase client not available');
    return null;
  }

  try {
    console.log('[uploadAvatar] Fetching local image URI:', localUri);
    const response = await fetch(localUri);
    const blob = await response.blob();

    const fileExt = localUri.split('.').pop() || 'jpg';
    const fileName = `avatar-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('[uploadAvatar] Uploading image blob to storage bucket "avatars":', filePath);
    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(filePath, blob, {
        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('[uploadAvatar] Storage upload failed:', uploadError.message);
      throw uploadError;
    }

    const { data } = client.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = data.publicUrl;
    console.log('[uploadAvatar] Upload succeeded. Public URL:', publicUrl);

    const ok = await updateProfile(userId, { avatar_url: publicUrl });
    if (!ok) {
      console.warn('[uploadAvatar] Failed to update profile database row with avatar URL');
      return null;
    }

    return publicUrl;
  } catch (error) {
    console.warn('[uploadAvatar] Failed to upload avatar:', error);
    return null;
  }
}


// ─── Community Feed ──────────────────────────────────────────────

export type FeedSort = 'recent' | 'trending' | 'lowest';
/** Opaque keyset cursor — the caller just stores it and passes it back. */
export interface FeedCursor { createdAt: string; score: number; count: number; }
export interface FeedPage { posts: CommunityPost[]; nextCursor: FeedCursor | null; hasMore: boolean; }

/**
 * One page of the community feed, ordered + keyset-paginated server-side per tab:
 *   recent   → created_at DESC                       (created_at is the unique cursor)
 *   lowest   → score ASC, created_at ASC             (composite — score has heavy ties)
 *   trending → reaction_count DESC, created_at DESC  (composite — counts have heavy ties)
 * Fetches limit+1 to detect `hasMore` with no count query. created_at is double-quoted
 * inside the composite .or() so its timezone "+" survives URL encoding.
 */
export async function getCommunityFeed(
  opts: { sort?: FeedSort; userId?: string; cursor?: FeedCursor | null; limit?: number } = {},
): Promise<FeedPage> {
  const { sort = 'recent', userId, cursor = null, limit = 20 } = opts;
  const empty: FeedPage = { posts: [], nextCursor: null, hasMore: false };
  const client = getSupabase();
  if (!client) return empty;
  try {
    let query = (client as any).from('community_posts').select('*');

    if (sort === 'lowest') {
      query = query.order('score', { ascending: true }).order('created_at', { ascending: true });
      if (cursor) query = query.or(`score.gt.${cursor.score},and(score.eq.${cursor.score},created_at.gt."${cursor.createdAt}")`);
    } else if (sort === 'trending') {
      query = query.order('reaction_count', { ascending: false }).order('created_at', { ascending: false });
      if (cursor) query = query.or(`reaction_count.lt.${cursor.count},and(reaction_count.eq.${cursor.count},created_at.lt."${cursor.createdAt}")`);
    } else {
      query = query.order('created_at', { ascending: false });
      if (cursor) query = query.lt('created_at', cursor.createdAt);
    }
    query = query.limit(limit + 1);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    let posts: CommunityPost[] = pageRows.map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      display_name: p.display_name,
      score: p.score,
      score_label: p.score_label,
      roast: p.roast,
      summary: p.summary,
      reactions: p.reactions || {},
      created_at: p.created_at,
      my_reactions: [],
    }));

    if (userId && posts.length) {
      const ids = posts.map((p) => p.id);
      const { data: myReactions } = await (client as any)
        .from('post_reactions')
        .select('post_id, emoji')
        .eq('user_id', userId)
        .in('post_id', ids);
      const reactMap: Record<string, string[]> = {};
      (myReactions || []).forEach((r: any) => { (reactMap[r.post_id] ||= []).push(r.emoji); });
      posts = posts.map((p) => ({ ...p, my_reactions: reactMap[p.id] || [] }));
    }

    const last: any = pageRows[pageRows.length - 1];
    const nextCursor: FeedCursor | null = hasMore && last
      ? { createdAt: last.created_at, score: last.score, count: last.reaction_count ?? 0 }
      : null;

    return { posts, nextCursor, hasMore };
  } catch (error) {
    console.warn('Failed to fetch community feed:', error);
    return empty;
  }
}

/** Authoritative reaction state for a single post — used to patch one card after an
 *  optimistic reaction fails, without resetting the whole paginated feed. */
export async function getPostReactions(
  postId: string,
  userId?: string,
): Promise<{ reactions: Record<string, number>; my_reactions: string[] } | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await (client as any)
      .from('community_posts')
      .select('reactions')
      .eq('id', postId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    let my_reactions: string[] = [];
    if (userId) {
      const { data: mine } = await (client as any)
        .from('post_reactions')
        .select('emoji')
        .eq('post_id', postId)
        .eq('user_id', userId);
      my_reactions = (mine || []).map((r: any) => r.emoji);
    }
    return { reactions: data.reactions || {}, my_reactions };
  } catch (error) {
    console.warn('Failed to fetch post reactions:', error);
    return null;
  }
}

export async function shareToFeed(
  userId: string,
  analysisId: string,
  score: number,
  scoreLabel: string,
  roast: string,
  summary: string,
  shareCaptions?: any[],
): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const profile = await getProfile(userId);
    const displayName = profile?.username
      ? `anon_${profile.username.slice(0, 8)}`
      : `anon_${userId.slice(0, 8)}`;
    const { data, error } = await (client as any)
      .from('community_posts')
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        display_name: displayName,
        score,
        score_label: scoreLabel,
        roast,
        summary,
        share_captions: shareCaptions || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.warn('Failed to share to feed:', error);
    return null;
  }
}

/** Analysis IDs the user currently has live in the community feed (drives the share manager toggles). */
export async function getMySharedAnalysisIds(userId: string): Promise<string[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await (client as any)
      .from('community_posts')
      .select('analysis_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((r: any) => r.analysis_id).filter(Boolean);
  } catch (error) {
    console.warn('Failed to fetch shared analysis ids:', error);
    return [];
  }
}

/** Remove the user's post for an analysis from the feed (RLS allows deleting own posts;
 *  post_reactions cascade-delete, so reactions are lost — re-sharing starts fresh). */
export async function unshareFromFeed(analysisId: string, userId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('community_posts')
      .delete()
      .eq('analysis_id', analysisId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to unshare from feed:', error);
    return false;
  }
}

export async function addReaction(postId: string, userId: string, emoji: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('post_reactions')
      .insert({ post_id: postId, user_id: userId, emoji });
    if (error?.code === '23505') return false;
    if (error) throw error;

    return true;
  } catch (error) {
    console.warn('Failed to add reaction:', error);
    return false;
  }
}

export async function removeReaction(postId: string, userId: string, emoji: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    if (error) throw error;

    return true;
  } catch (error) {
    console.warn('Failed to remove reaction:', error);
    return false;
  }
}

// ─── Subscriptions ──────────────────────────────────────────────

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await (client as any)
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      amount: parseFloat(s.amount),
      icon: s.icon || '💸',
      category: s.category || '',
      last_used: s.last_used || '',
    }));
  } catch (error) {
    console.warn('Failed to fetch subscriptions:', error);
    return [];
  }
}

export async function saveSubscription(userId: string, sub: Omit<Subscription, 'id'>): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await (client as any)
      .from('subscriptions')
      .insert({ user_id: userId, ...sub })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.warn('Failed to save subscription:', error);
    return null;
  }
}

export async function deleteSubscription(userId: string, subId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('subscriptions')
      .delete()
      .eq('id', subId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to delete subscription:', error);
    return false;
  }
}

// ─── Check-Ins ──────────────────────────────────────────────────

export async function saveCheckIn(userId: string, data: {
  mood: number;
  notes?: string;
  income?: number;
  expenses?: number;
  savings?: number;
  debt?: number;
  metrics?: Record<string, number>;
}): Promise<string | null> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) return 'mock-checkin-id';
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data: result, error } = await (client as any)
      .from('check_ins')
      .insert({ user_id: userId, ...data })
      .select('id')
      .single();
    if (error) throw error;
    return result.id;
  } catch (error) {
    console.warn('Failed to save check-in:', error);
    return null;
  }
}

export async function getCheckIns(userId: string): Promise<CheckIn[]> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { MOCK_CHECKINS } = require('@/__fixtures__/mockHistory');
    return MOCK_CHECKINS;
  }
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await (client as any)
      .from('check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((c: any) => ({
      id: c.id,
      mood: c.mood,
      notes: c.notes,
      income: c.income ? parseFloat(c.income) : null,
      expenses: c.expenses ? parseFloat(c.expenses) : null,
      savings: c.savings ? parseFloat(c.savings) : null,
      debt: c.debt ? parseFloat(c.debt) : null,
      created_at: c.created_at,
      metrics: c.metrics ?? null,
    }));
  } catch (error) {
    console.warn('Failed to fetch check-ins:', error);
    return [];
  }
}

/** Read the user's monthly check-in config (pinned goals + schedule anchor). */
export async function getCheckinConfig(userId: string): Promise<CheckinConfig> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { MOCK_CHECKIN_CONFIG } = require('@/__fixtures__/mockHistory');
    return MOCK_CHECKIN_CONFIG;
  }
  const client = getSupabase();
  if (!client) return EMPTY_CHECKIN_CONFIG;
  try {
    const { data, error } = await (client as any)
      .from('profiles')
      .select('checkin_config')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.checkin_config as CheckinConfig) ?? EMPTY_CHECKIN_CONFIG;
  } catch (error) {
    console.warn('Failed to fetch check-in config:', error);
    return EMPTY_CHECKIN_CONFIG;
  }
}

export async function saveCheckinConfig(userId: string, config: CheckinConfig): Promise<boolean> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) return true;
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('profiles')
      .update({ checkin_config: config })
      .eq('id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to save check-in config:', error);
    return false;
  }
}

export async function getAnalysisById(id: string): Promise<FinalAnalysis | null> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { getMockAnalysisById } = require('@/__fixtures__/mockHistory');
    return getMockAnalysisById(id);
  }
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await (client as any)
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) return null;
    return {
      monthlyIncome: { value: parseFloat(data.monthly_income), confidence: 'medium' },
      monthlyExpenses: { value: parseFloat(data.monthly_expenses), confidence: 'medium' },
      liquidSavings: { value: data.liquid_savings ?? 0, confidence: data.avg_confidence ? 'medium' : 'low' },
      monthlySavings: parseFloat(data.monthly_savings),
      savingsRate: parseFloat(data.savings_rate),
      debtTotal: parseFloat(data.debt_total),
      monthlyDebtService: data.monthly_debt_service ?? 0,
      emergencyFundMonths: parseFloat(data.emergency_fund_months),
      debtToIncomeRatio: parseFloat(data.debt_to_income_ratio),
      avgConfidence: data.avg_confidence ?? 0.5,
      score: data.score,
      scoreLabel: data.score_label,
      scoreColor: data.score_color,
      summary: data.summary,
      roast: data.roast,
      debts: data.debts || [],
      cfpb_responses: data.cfpb_responses ?? [],
      scoreModifier: data.score_modifier ?? 0,
      scoreModifierReason: data.score_modifier_reason ?? '',
      insights: data.insights || [],
      topProblems: data.top_problems ?? [],
      positiveBehaviors: data.positive_behaviors ?? [],
      topFix: data.top_fix ?? null,
      emotionalStatus: data.emotional_status ?? null,
      mentionedSpending: data.mentioned_spending ?? [],
    };
  } catch (err) {
    console.warn('Failed to fetch analysis by id:', err);
    return null;
  }
}

// ─── Caption generation ──────────────────────────────────────────

export async function fetchOrGenerateCaptions(
  analysis: FinalAnalysis,
  tone: RoastTone,
  analysisId?: string,
): Promise<CaptionResponse | null> {
  const { USE_AI_MOCKS } = require('@/config/ai');
  if (USE_AI_MOCKS) {
    const { SAMPLE_CAPTIONS } = require('../__fixtures__/sampleAnalysis');
    await new Promise((r) => setTimeout(r, 600));
    return SAMPLE_CAPTIONS;
  }
  const client = getSupabase();
  if (!client) return null;

  try {
    if (analysisId) {
      const { data: row } = await (client as any)
        .from('analyses')
        .select('share_captions')
        .eq('id', analysisId)
        .single();

      if (row?.share_captions) {
        const parsed = CaptionResponseSchema.safeParse(row.share_captions);
        if (parsed.success) return parsed.data;
      }
    }

    const { data, error } = await client.functions.invoke('generate-captions', {
      body: {
        score: analysis.score,
        scoreLabel: analysis.scoreLabel,
        roast: analysis.roast,
        tone,
      },
    });

    if (error) {
      console.warn('[captions] invoke error:', error);
      return null;
    }

    const parsed = CaptionResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('[captions] invalid response shape:', parsed.error.issues);
      return null;
    }

    if (analysisId) {
      await (client as any)
        .from('analyses')
        .update({ share_captions: parsed.data })
        .eq('id', analysisId);
    }

    return parsed.data;
  } catch (e) {
    console.warn('[captions] failed:', e);
    return null;
  }
}

export { analyzeFinancialSituation as analyzeFinances };
