import { createClient } from '@supabase/supabase-js';
import { FinalAnalysisSchema, ActionPlanResponseSchema, CaptionResponseSchema } from '@shared/schemas';
import { FinalAnalysis, ActionPlanStep, CaptionResponse, ActionPlanResponse } from '@shared/types';
import { RoastTone, AnalysisHistoryItem, CommunityPost, Subscription, CheckIn } from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

export function __setSupabaseForTests(client: ReturnType<typeof createClient> | null) {
  supabase = client;
}

export function getSupabase() {
  if (!supabase && supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
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

export async function analyzeFinancialSituation(
  userInput: string,
  tone: RoastTone = 'savage',
  signal?: AbortSignal,
  retries = 2,
  userContext?: Record<string, unknown>,
): Promise<FinalAnalysis> {
  console.log('[analyze] Starting analysis', { userInputLength: userInput.length, tone });
  const cleaned = cleanUserInput(userInput);
  console.log('[analyze] Cleaned input:', cleaned.substring(0, 100) + (cleaned.length > 100 ? '...' : ''));
  const client = getSupabase();
  if (!client) {
    console.error('[analyze] FATAL: supabase client not available. EXPO_PUBLIC_SUPABASE_URL set?', !!supabaseUrl, 'EXPO_PUBLIC_SUPABASE_ANON_KEY set?', !!supabaseAnonKey);
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
          userContext: userContext ?? {},
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

export async function fetchOrGenerateActionPlan(
  analysis: FinalAnalysis,
  tone: RoastTone,
  analysisId?: string,
): Promise<ActionPlanResponse | null> {
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

// Thin wrapper for backward compat — callers should use fetchOrGenerateActionPlan
export async function fetchActionPlan(userId: string, analysisId?: string): Promise<ActionPlanStep[]> {
  const steps = await fetchOrGenerateActionPlan({} as any, 'savage', analysisId);
  return steps?.steps ?? [];
}

export async function getAnalysisHistory(userId: string): Promise<AnalysisHistoryItem[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await (client as any)
      .from('analyses')
      .select('id, score, score_label, summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
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

export async function getCommunityFeed(userId?: string): Promise<CommunityPost[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    let query = (client as any)
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data, error } = await query;
    if (error) throw error;

    let posts: CommunityPost[] = (data || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      display_name: p.display_name,
      score: p.score,
      score_label: p.score_label,
      roast: p.roast,
      summary: p.summary,
      reactions: p.reactions || { fire: 0, cry: 0, skull: 0 },
      created_at: p.created_at,
    }));

    if (userId) {
      const { data: myReactions } = await (client as any)
        .from('post_reactions')
        .select('post_id, emoji')
        .eq('user_id', userId);
      const reactMap: Record<string, string> = {};
      (myReactions || []).forEach((r: any) => { reactMap[r.post_id] = r.emoji; });
      posts = posts.map((p) => ({ ...p, my_reaction: reactMap[p.id] || null }));
    }

    return posts;
  } catch (error) {
    console.warn('Failed to fetch community feed:', error);
    return [];
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

export async function addReaction(postId: string, userId: string, emoji: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from('post_reactions')
      .insert({ post_id: postId, user_id: userId, emoji });
    if (error?.code === '23505') return false;
    if (error) throw error;

    const emojiKey = emoji === '🔥' ? 'fire' : emoji === '😭' ? 'cry' : 'skull';
    const { error: updateError } = await (client as any)
      .rpc('increment_reaction', { post_id: postId, reaction_key: emojiKey });
    if (updateError) console.warn('Failed to update reaction count:', updateError);

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

    const emojiKey = emoji === '🔥' ? 'fire' : emoji === '😭' ? 'cry' : 'skull';
    const { error: updateError } = await (client as any)
      .rpc('decrement_reaction', { post_id: postId, reaction_key: emojiKey });
    if (updateError) console.warn('Failed to update reaction count:', updateError);

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
}): Promise<string | null> {
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
    }));
  } catch (error) {
    console.warn('Failed to fetch check-ins:', error);
    return [];
  }
}

export async function getAnalysisById(id: string): Promise<FinalAnalysis | null> {
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
