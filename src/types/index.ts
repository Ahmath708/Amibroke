import type { NavigatorScreenParams, CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FinalAnalysis as _FinalAnalysis, DebtItem as _DebtItem, ActionPlanStep as _ActionStep, Tone as _Tone } from '@shared/types';

export type RoastTone = _Tone;
export type FinancialAnalysis = _FinalAnalysis;
export type DebtItem = _DebtItem;
export type ActionStep = _ActionStep;

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
  reactions: Record<string, number>; // emoji → count (see post_reactions CHECK, migration 00011)
  created_at: string;
  my_reactions: string[];            // emojis the current user has reacted with (multiple allowed)
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
  /** Per-event values for pinned goals, keyed by TrackedGoal.id. */
  metrics?: Record<string, number> | null;
}

// ─── Monthly check-in: pinned-goal tracking ───
/** Derived/extracted metrics a user can pin to track month over month. */
export type MetricKey =
  | 'liquidSavings'
  | 'savingsRate'
  | 'emergencyFundMonths'
  | 'debtTotal'
  | 'monthlySavings'
  | 'debtToIncomeRatio'
  | 'monthlyIncome'
  | 'monthlyExpenses';

export type GoalKind = 'metric' | 'debt';
export type GoalUnit = 'currency' | 'percent' | 'months' | 'number';
/** Which direction counts as improvement (savings up, debt/expenses down). */
export type GoalDirection = 'up' | 'down';

export interface TrackedGoal {
  id: string;                       // stable id (key for CheckIn.metrics)
  kind: GoalKind;
  key: string;                      // MetricKey for 'metric'; debt name for 'debt'
  label: string;                    // display label
  unit: GoalUnit;
  direction: GoalDirection;
  baseline: number;                 // value when pinned
  baselineDate: string;             // ISO
  target?: number | null;           // optional goal target
  sourceAnalysisId?: string | null; // analysis the goal was pinned from
}

export interface CheckinConfig {
  firstAnalyzeAt: string | null;    // ISO — schedule anchor source
  anchorDay: number | null;         // 1..31 day-of-month the check-in is due
  goals: TrackedGoal[];
}

export const EMPTY_CHECKIN_CONFIG: CheckinConfig = { firstAnalyzeAt: null, anchorDay: null, goals: [] };

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

// Bottom-tab routes (live inside MainTabs). 3 tabs: dashboard, premium hub, social.
// History & Profile are no longer tabs — they're pushed routes (History from the
// dashboard's "View all"; Profile from the dashboard's avatar button).
export type MainTabsParamList = {
  Home: undefined;
  Tools: undefined;
  Community: undefined;
};

// Navigation prop for a bottom-tab screen that can also push root-stack screens.
export type TabScreenNav<T extends keyof MainTabsParamList> = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, T>,
  NativeStackNavigationProp<RootStackParamList>
>;

// Root native-stack routes. Tabs are reached via MainTabs → { screen: '<Tab>' }.
export type RootStackParamList = {
  // Auth + first-run gates
  Landing: undefined;
  Login: { mode?: 'login' | 'signup' } | undefined;
  Onboarding: undefined;
  UsernameSetup: undefined;
  // App
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  Analyze: undefined;           // the "New roast" input (also the first-run Home)
  History: undefined;           // pushed from the dashboard trend / "View all"
  Profile: undefined;           // pushed from the dashboard avatar button
  Processing: { userInput: string; tone?: RoastTone; userContext?: Record<string, unknown> };
  Results: { analysis: FinancialAnalysis; userInput: string };
  Share: { analysis: FinancialAnalysis };
  Paywall: undefined;
  ActionPlan: { steps: ActionStep[]; analysis?: FinancialAnalysis; overallMessage?: string; analysisId?: string };
  DebtPayoff: { debts: DebtItem[]; monthlyIncome: number };
  ScenarioSimulator: undefined;
  SubscriptionAudit: undefined;
  AllAnalyses: undefined;
  FinancialContext: undefined;
  Settings: undefined;
  HelpFAQ: undefined;
  MonthlyCheckIn: { setup?: boolean } | undefined;
  CreatorDashboard: undefined;
};
