// Cross-runtime trial logic — the single source for the 3-day free-access window,
// shared by the app (src/services/subscriptions.ts) and the Deno edge functions
// (supabase/functions/_shared/entitlement.ts). Framework-agnostic: no RN/Deno
// imports, only JS built-ins.
//
// New users get TRIAL_DURATION_DAYS of full access derived from the account's
// server-set created_at (not client-tamperable). After it expires it's a hard
// paywall — no permanent free tier.

export const TRIAL_DURATION_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrialStatus {
  active: boolean;
  daysLeft: number; // whole days remaining (ceil), 0 once expired
  endsAt: Date | null;
}

/** Derive the 3-day free-access window from the account's creation timestamp. */
export function getTrialStatus(createdAt: string | null | undefined, now: Date = new Date()): TrialStatus {
  if (!createdAt) return { active: false, daysLeft: 0, endsAt: null };
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return { active: false, daysLeft: 0, endsAt: null };
  const endsAt = new Date(created.getTime() + TRIAL_DURATION_DAYS * DAY_MS);
  const msLeft = endsAt.getTime() - now.getTime();
  if (msLeft <= 0) return { active: false, daysLeft: 0, endsAt };
  return { active: true, daysLeft: Math.ceil(msLeft / DAY_MS), endsAt };
}
