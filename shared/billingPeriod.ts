// Billing cadence for a tracked subscription (`tracked_subscriptions.billing_period`). Single source
// of truth shared by the app (the SubscriptionAudit selector + the monthly-cost math) and the DB
// CHECK constraint, so the two can never drift. Framework-agnostic — no RN/Deno imports.

export const BILLING_PERIODS = ['weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const DEFAULT_BILLING_PERIOD: BillingPeriod = 'monthly';

/** Human labels for the selector UI. */
export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Every 6 months',
  yearly: 'Yearly',
};

/** Factor to convert a charge billed every `period` into its equivalent MONTHLY cost. */
export const MONTHLY_FACTOR: Record<BillingPeriod, number> = {
  weekly: 52 / 12, // 52 weekly charges spread across 12 months
  monthly: 1,
  quarterly: 1 / 3, // one charge every 3 months
  semiannual: 1 / 6, // one charge every 6 months
  yearly: 1 / 12, // one charge every 12 months
};

/** Normalize a charge of `amount` billed every `period` to its monthly-equivalent cost. */
export function toMonthly(amount: number, period: BillingPeriod): number {
  return amount * MONTHLY_FACTOR[period];
}

export function isBillingPeriod(v: unknown): v is BillingPeriod {
  return typeof v === 'string' && (BILLING_PERIODS as readonly string[]).includes(v);
}
