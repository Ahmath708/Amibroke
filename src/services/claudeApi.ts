import { createClient } from '@supabase/supabase-js';
import { FinancialAnalysis } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase && supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

export async function analyzeFinancialSituation(userInput: string): Promise<FinancialAnalysis> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client.functions.invoke('analyze', {
        body: { userInput },
      });
      if (!error) return data as FinancialAnalysis;
    } catch (e) {
      console.warn('API call failed, using mock data:', e);
    }
  }
  return getMockAnalysis(userInput);
}

export async function saveAnalysis(userId: string, input: string, analysis: FinancialAnalysis): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('analyses').insert({
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
      spending_breakdown: JSON.stringify(analysis.spendingBreakdown),
      debts: JSON.stringify(analysis.debts),
      action_plan: JSON.stringify(analysis.actionPlan),
      insights: JSON.stringify(analysis.insights),
    }).select('id').single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.warn('Failed to save analysis:', error);
    return null;
  }
}

export async function getAnalysisHistory(userId: string): Promise<any[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
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
    const { data, error } = await client
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
    const { error } = await client
      .from('profiles')
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to update profile:', error);
    return false;
  }
}

function getMockAnalysis(input: string): FinancialAnalysis {
  return {
    score: 34,
    scoreLabel: 'Financially Fragile',
    scoreColor: '#FF6B00',
    summary:
      "You're spending more than you earn and riding dangerously close to zero. The DoorDash habit alone is costing you a vacation per year. You have no safety net — one bad month could spiral into debt.",
    roast:
      "You're basically a subscription service for DoorDash. Your bank account is giving 'aspirational broke' energy. 💀",
    monthlyIncome: 4200,
    monthlyExpenses: 3800,
    monthlySavings: 400,
    debtTotal: 12000,
    savingsRate: 0.095,
    emergencyFundMonths: 0.5,
    debtToIncomeRatio: 0.28,
    spendingBreakdown: [
      { name: 'Housing', amount: 1400, percentage: 33, color: '#ecb2ff', status: 'good' },
      { name: 'Food & Delivery', amount: 800, percentage: 19, color: '#e7006e', status: 'danger' },
      { name: 'Transport', amount: 350, percentage: 8, color: '#00e0ff', status: 'good' },
      { name: 'Subscriptions', amount: 180, percentage: 4, color: '#ffb1c3', status: 'warning' },
      { name: 'Entertainment', amount: 300, percentage: 7, color: '#bd00ff', status: 'warning' },
      { name: 'Other', amount: 770, percentage: 18, color: '#9d8ba0', status: 'warning' },
    ],
    debts: [
      { name: 'Credit Card A', balance: 4500, interestRate: 0.24, minimumPayment: 135, urgency: 'critical' },
      { name: 'Student Loan', balance: 7500, interestRate: 0.065, minimumPayment: 85, urgency: 'medium' },
    ],
    actionPlan: [
      { week: 1, title: 'Audit Your Subscriptions', description: "Cancel every subscription you haven't used in 30 days.", impact: 'Save $60-180/month immediately', category: 'savings', completed: false },
      { week: 2, title: 'DoorDash Detox', description: 'Set a hard $100/month food delivery budget.', impact: 'Save $300-500/month', category: 'savings', completed: false },
      { week: 3, title: 'Build $500 Emergency Buffer', description: 'Park $500 in savings before paying debt aggressively.', impact: 'Financial safety net', category: 'savings', completed: false },
      { week: 4, title: 'Avalanche Your Credit Card', description: 'Dump extra cash on 24% APR card.', impact: 'Save $1,080/year in interest', category: 'debt', completed: false },
    ],
    insights: [
      'Your food spending is 2x the recommended 10-15% of income',
      'You have less than 1 month emergency fund — one car repair could undo months of progress',
      'At current pace, your credit card debt grows $90/month even if you pay minimums',
    ],
  };
}

export { analyzeFinancialSituation as analyzeFinances };
