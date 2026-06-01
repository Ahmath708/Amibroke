import type { FinalAnalysis as _FinalAnalysis, DebtItem as _DebtItem, ActionPlanStep as _ActionStep, Tone as _Tone } from '@shared/types';

export type RoastTone = _Tone;
export type FinancialAnalysis = _FinalAnalysis;
export type DebtItem = _DebtItem;
export type ActionStep = _ActionStep;

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
  emotional_status?: { label: string; emoji: string } | null;
  has_action_plan?: boolean;
  has_captions?: boolean;
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
  UsernameSetup: undefined;
  Input: undefined;
  Processing: { userInput: string; tone?: RoastTone; userContext?: Record<string, unknown> };
  Results: { analysis: FinancialAnalysis; userInput: string };
  Share: { analysis: FinancialAnalysis };
  Paywall: undefined;
  ActionPlan: { steps: ActionStep[]; analysis?: FinancialAnalysis; overallMessage?: string };
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
  MonthlyCheckIn: undefined;
  CreatorDashboard: undefined;
  MainTabs: undefined;
};
