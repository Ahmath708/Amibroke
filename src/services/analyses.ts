// Analyses CRUD — persist, list, paginate, fetch and clear the user's roasts.
// Mocked in dev via @/config/ai (mock history fixtures).
import { FinalAnalysis } from '@shared/types';
import { TABLES, HISTORY_COLUMNS } from './tables';
import { AnalysisHistoryItem } from '@/types';
import { USE_AI_MOCKS } from '@/config/ai';
import { withClient } from './supabaseClient';

export async function saveAnalysis(userId: string, input: string, analysis: FinalAnalysis): Promise<string | null> {
  return withClient('save analysis', null, async (client) => {
    const { data, error } = await (client as any).from(TABLES.analyses).insert({
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
    if (error) throw error;
    return data.id;
  });
}

export async function getAnalysisHistory(userId: string): Promise<AnalysisHistoryItem[]> {
  if (USE_AI_MOCKS) {
    const { MOCK_HISTORY } = require('@/__fixtures__/mockHistory');
    return MOCK_HISTORY;
  }
  return withClient('fetch history', [], async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.analyses)
      .select(HISTORY_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapAnalysisRow);
  });
}

export interface AnalysesPage { items: AnalysisHistoryItem[]; nextCursor: string | null; hasMore: boolean; }

function mapAnalysisRow(row: any): AnalysisHistoryItem {
  return {
    id: row.id,
    score: row.score,
    score_label: row.score_label,
    summary: row.summary,
    created_at: row.created_at,
    emotional_status: row.emotional_status,
    has_action_plan: !!(row.action_plan && (Array.isArray(row.action_plan) ? row.action_plan.length > 0 : true)),
    has_captions: !!row.share_captions,
  };
}

/** One keyset-paginated page of all the user's analyses (created_at DESC) — for the
 *  "View All" screen. N+1 to detect hasMore, cursor = last item's created_at. */
export async function getAnalysesPage(
  opts: { userId: string; cursor?: string | null; limit?: number },
): Promise<AnalysesPage> {
  const { userId, cursor = null, limit = 20 } = opts;
  if (USE_AI_MOCKS) {
    const { MOCK_HISTORY } = require('@/__fixtures__/mockHistory');
    const all: AnalysisHistoryItem[] = MOCK_HISTORY;
    const start = cursor ? all.findIndex((a) => a.created_at === cursor) + 1 : 0;
    const items = all.slice(start, start + limit);
    const hasMore = start + limit < all.length;
    return { items, nextCursor: items.length ? items[items.length - 1].created_at : null, hasMore };
  }
  const empty: AnalysesPage = { items: [], nextCursor: null, hasMore: false };
  return withClient('fetch analyses page', empty, async (client) => {
    let q = (client as any)
      .from(TABLES.analyses)
      .select(HISTORY_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    if (cursor) q = q.lt('created_at', cursor);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(mapAnalysisRow);
    return { items, nextCursor: items.length ? items[items.length - 1].created_at : null, hasMore };
  });
}

export async function getAnalysisById(id: string): Promise<FinalAnalysis | null> {
  if (USE_AI_MOCKS) {
    const { getMockAnalysisById } = require('@/__fixtures__/mockHistory');
    return getMockAnalysisById(id);
  }
  return withClient<FinalAnalysis | null>('fetch analysis by id', null, async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.analyses)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) return null;
    // Guard parseFloat against null/garbage columns so NaN never leaks into the analysis.
    const num = (v: any, fallback = 0) => {
      const n = parseFloat(v);
      return Number.isNaN(n) ? fallback : n;
    };
    return {
      monthlyIncome: { value: num(data.monthly_income), confidence: 'medium' },
      monthlyExpenses: { value: num(data.monthly_expenses), confidence: 'medium' },
      liquidSavings: { value: data.liquid_savings ?? 0, confidence: data.avg_confidence ? 'medium' : 'low' },
      monthlySavings: num(data.monthly_savings),
      savingsRate: num(data.savings_rate),
      debtTotal: num(data.debt_total),
      monthlyDebtService: data.monthly_debt_service ?? 0,
      emergencyFundMonths: num(data.emergency_fund_months),
      debtToIncomeRatio: num(data.debt_to_income_ratio),
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
  });
}

/** Delete all of the user's analyses (Settings → Clear Analysis History).
 *  RLS allows deleting own rows; community_posts.analysis_id is ON DELETE SET NULL. */
export async function deleteAllAnalyses(userId: string): Promise<boolean> {
  return withClient('clear analyses', false, async (client) => {
    const { error } = await (client as any).from(TABLES.analyses).delete().eq('user_id', userId);
    if (error) throw error;
    return true;
  });
}
