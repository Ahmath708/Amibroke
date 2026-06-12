import type { NavigatorScreenParams, CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FinalAnalysis as _FinalAnalysis, DebtItem as _DebtItem, ActionPlanStep as _ActionStep, Tone as _Tone } from '@shared/types';
import type { BillingPeriod } from '@shared/billingPeriod';

export type RoastTone = _Tone;
export type FinancialAnalysis = _FinalAnalysis;
export type DebtItem = _DebtItem;
export type ActionStep = _ActionStep;

export interface AnalysisHistoryItem {
  id: string;
  input_text?: string | null; // the user's original free-text (preview snippet on All Roasts)
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
  category: string;
  billing_period: BillingPeriod;   // NEW (schema-v2): cadence; normalize to monthly via @shared/billingPeriod
  last_used: string;
}

export interface CheckIn {
  id: string;
  mood: number;
  notes: string | null;
  created_at: string;
  /** All recorded figures this check-in (income/expenses/savings/debt + per-goal values), keyed.
   *  schema-v2: the point-in-time history — the snapshot keeps only current state, no flat columns. */
  metrics?: Record<string, number> | null;
  /** The Haiku "coach's note" generated for this check-in (unified financial model §7). */
  reflection?: string | null;
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
  action_plan: { label: 'Action Plan', price: 4.99, description: 'Full 90-day step-by-step plan with weekly goals' }, // the TIER (what you buy); the FEATURE is "90-Day Action Plan" (config/tools.ts)
  deep_dive: { label: 'Deep Dive', price: 9.99, description: 'Everything in Action Plan plus scenario simulator, debt comparison, and PDF report' },
};

// Bottom-tab routes (live inside MainTabs). Five tabs: Home (dashboard), Tools (premium hub),
// Roast (the composer), Community (social), Profile. History is a pushed route (dashboard "View all").
export type MainTabsParamList = {
  Home: undefined;
  Tools: undefined;
  Roast: undefined;     // a real dwell tab — renders the composer (RoastComposerScreen with asTab)
  Community: undefined;
  Profile: undefined;
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
  // App
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  Analyze: undefined;           // the "New roast" input (also the first-run Home)
  History: undefined;           // pushed from the dashboard trend / "View all"
  Processing: { userInput: string; tone?: RoastTone; userContext?: Record<string, unknown> };
  Results: { analysis: FinancialAnalysis; userInput: string; analysisId?: string }; // analysisId set when VIEWING a saved roast → read-only (no re-save/merge)
  Share: { analysis: FinancialAnalysis };
  Paywall: undefined;
  ActionPlan: { steps?: ActionStep[]; analysis?: FinancialAnalysis; overallMessage?: string; analysisId?: string; preview?: boolean };
  DebtPayoff: { preview?: boolean } | undefined; // reads the unified snapshot; preview = paywall peek (read-only)
  ScenarioSimulator: undefined;
  SubscriptionAudit: undefined;
  FinancialContext: undefined;
  EditProfile: undefined;
  RoastVoice: { current: RoastTone }; // Profile → voice-card picker (modal)
  Notifications: undefined;
  HelpFAQ: undefined;
  MonthlyCheckIn: { setup?: boolean } | undefined;
  CreatorDashboard: undefined;
};
