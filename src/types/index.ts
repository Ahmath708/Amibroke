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

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Home: undefined;
  Input: undefined;
  Processing: { userInput: string };
  Results: { analysis: FinancialAnalysis; userInput: string };
  Share: { analysis: FinancialAnalysis };
  Paywall: undefined;
  Payment: undefined;
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
