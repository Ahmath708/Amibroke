import { createClient } from '@supabase/supabase-js';
import { FinancialAnalysis, SpendingCategory, DebtItem, ActionStep, AnalysisHistoryItem, CommunityPost, Subscription, CheckIn, RoastTone } from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase && supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((i) => typeof i === 'string');
}

function isSpendingCategory(v: unknown): v is SpendingCategory {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.amount === 'number' && typeof o.percentage === 'number' && typeof o.color === 'string' && (o.status === 'good' || o.status === 'warning' || o.status === 'danger');
}

function isDebtItem(v: unknown): v is DebtItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.balance === 'number' && typeof o.interestRate === 'number' && typeof o.minimumPayment === 'number' && (o.urgency === 'low' || o.urgency === 'medium' || o.urgency === 'high' || o.urgency === 'critical');
}

function isActionStep(v: unknown): v is ActionStep {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.week === 'number' && typeof o.title === 'string' && typeof o.description === 'string' && typeof o.impact === 'string' && (o.category === 'savings' || o.category === 'debt' || o.category === 'income' || o.category === 'mindset') && typeof o.completed === 'boolean';
}

export function isFinancialAnalysis(x: unknown): x is FinancialAnalysis {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  const required =
    typeof o.score === 'number' &&
    typeof o.scoreLabel === 'string' &&
    typeof o.scoreColor === 'string' &&
    typeof o.summary === 'string' &&
    typeof o.roast === 'string' &&
    typeof o.monthlyIncome === 'number' &&
    typeof o.monthlyExpenses === 'number' &&
    typeof o.monthlySavings === 'number' &&
    typeof o.debtTotal === 'number' &&
    typeof o.savingsRate === 'number' &&
    typeof o.emergencyFundMonths === 'number' &&
    typeof o.debtToIncomeRatio === 'number' &&
    Array.isArray(o.spendingBreakdown) && o.spendingBreakdown.every(isSpendingCategory) &&
    Array.isArray(o.debts) && o.debts.every(isDebtItem) &&
    Array.isArray(o.actionPlan) && o.actionPlan.every(isActionStep) &&
    isStringArray(o.insights);
  return required;
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
): Promise<FinancialAnalysis> {
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
        body: { userInput: cleaned, tone },
        signal,
      });

      if (error) {
        console.error('[analyze] invoke error — message:', error.message, 'context:', JSON.stringify(error.context || {}));
        const ctx = error.context as any;
        const stage = ctx?.stage || 'unknown';
        const detail = ctx?.rawResponse ? ctx.rawResponse.slice(0, 300) : error.message;
        lastError = new Error(`Analysis failed at stage "${stage}": ${detail}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      console.log('[analyze] Received data from edge function, validating...');
      if (!isFinancialAnalysis(data)) {
        console.error('[analyze] type validation FAILED — received shape:', JSON.stringify(data).slice(0, 500));
        // Fall back to mock data with user-visible toast would be handled by the client
        // For now, we'll throw an error that the client can catch and handle appropriately
        lastError = new Error('Analysis returned unexpected data format. Please try again.');
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      console.log('[analyze] Analysis successful, returning data');
      return data;
    } catch (e) {
      console.error('[analyze] Caught exception in attempt', attempt + 1, ':', e);
      if (e === lastError) throw e;
      lastError = e instanceof Error ? e : new Error('Unknown error');
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  console.error('[analyze] All retries exhausted, throwing last error:', lastError);
  throw lastError || new Error('Analysis failed after retries');
}

export async function saveAnalysis(userId: string, input: string, analysis: FinancialAnalysis): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await (client as any).from('analyses').insert({
      user_id: userId,
      input_text: input,
      score: analysis.score,
      score_label: analysis.scoreLabel,
      score_color: analysis.scoreColor,
      summary: analysis.summary,
      roast: analysis.roast,
      monthly_income: analysis.monthlyIncome,
      monthly_expenses: analysis.monthlyExpenses,
      monthly_savings: analysis.monthlySavings,
      debt_total: analysis.debtTotal,
      savings_rate: analysis.savingsRate,
      emergency_fund_months: analysis.emergencyFundMonths,
      debt_to_income_ratio: analysis.debtToIncomeRatio,
      spending_breakdown: analysis.spendingBreakdown,
      debts: analysis.debts,
      action_plan: analysis.actionPlan,
      insights: analysis.insights,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.warn('Failed to save analysis:', error);
    return null;
  }
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
    if (error?.code === '23505') return false; // already reacted
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
      icon: s.icon || '💳',
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

export { analyzeFinancialSituation as analyzeFinances };
