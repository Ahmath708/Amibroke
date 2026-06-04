// Single source for Supabase table / bucket names + shared column lists, so a
// typo surfaces at the import site instead of as a runtime PGRST error.

export const TABLES = {
  analyses: 'analyses',
  profiles: 'profiles',
  community_posts: 'community_posts',
  post_reactions: 'post_reactions',
  check_ins: 'check_ins',
  subscriptions: 'subscriptions',
  user_subscriptions: 'user_subscriptions',
  referrals: 'referrals',
  payments: 'payments',
  active_plans: 'active_plans',
} as const;

export const BUCKETS = {
  avatars: 'avatars',
} as const;

/** Columns for the analyses/history list — used by both getAnalysisHistory and
 *  getAnalysesPage (was duplicated verbatim). */
export const HISTORY_COLUMNS = 'id, score, score_label, summary, created_at, emotional_status, action_plan, share_captions';
