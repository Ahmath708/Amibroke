export type RoastTone = 'gentle' | 'savage' | 'therapist' | 'older_sibling' | 'finance_bro';

export interface FinancialAnalysis {
  score: number; // 0–100
  scoreLabel: string; // e.g. "Financially Fragile"
  scoreColor: string;
  summary: string;
  roast: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  debtTotal: number;
  savingsRate: number; // %
  spendingBreakdown: SpendingCategory[];
  debts: DebtItem[];
  actionPlan: ActionStep[];
  insights: string[];
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
  topProblems?: string[];
  positiveBehaviors?: string[];
  topFix?: { action: string; monthlyImpact: number };
  emotionalStatus?: { label: string; emoji: string };
}

export interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  status: 'good' | 'warning' | 'danger';
}

export interface DebtItem {
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActionStep {
  week: number;
  title: string;
  description: string;
  impact: string;
  category: 'savings' | 'debt' | 'income' | 'mindset';
  completed: boolean;
}

export interface HistorySnapshot {
  id: string;
  date: string;
  score: number;
  scoreLabel: string;
  summary: string;
}

export interface AnalysisHistoryItem {
  id: string;
  score: number;
  score_label: string;
  summary: string;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  display_name: string;
  score: number;
  score_label: string;
  roast: string;
  summary: string;
  reactions: { fire: number; cry: number; skull: number };
  created_at: string;
  my_reaction?: string | null;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  icon: string;
  category: string;
  last_used: string;
}

export interface CheckIn {
  id: string;
  mood: number;
  notes: string | null;
  income: number | null;
  expenses: number | null;
  savings: number | null;
  debt: number | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referred_id: string | null;
  code: string;
  status: string;
  payout_amount: number;
  created_at: string;
}

export type PurchaseTier = 'free' | 'action_plan' | 'deep_dive';

export const PURCHASE_PRODUCTS: Record<PurchaseTier, { label: string; price: number; description: string } | null> = {
  free: null,
  action_plan: { label: '90-Day Action Plan', price: 4.99, description: 'Full 90-day step-by-step plan with weekly goals' },
  deep_dive: { label: 'Deep Dive', price: 9.99, description: 'Everything in Action Plan plus scenario simulator, debt comparison, and PDF report' },
};

export type RootStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Onboarding: undefined;
  Login: undefined;
  Home: undefined;
  Input: undefined;
  Processing: { userInput: string; tone?: RoastTone };
  Results: { analysis: FinancialAnalysis; userInput: string };
  Share: { analysis: FinancialAnalysis };
  Paywall: undefined;
  Payment: { product: 'action_plan' | 'deep_dive' };
  ActionPlan: { steps: ActionStep[] };
  DebtPayoff: { debts: DebtItem[]; monthlyIncome: number };
  ScenarioSimulator: undefined;
  History: undefined;
  SubscriptionAudit: undefined;
  CommunityFeed: undefined;
  Profile: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  HelpFAQ: undefined;
  Affiliate: undefined;
  MonthlyCheckIn: undefined;
  CreatorDashboard: undefined;
  MainTabs: undefined;
};
