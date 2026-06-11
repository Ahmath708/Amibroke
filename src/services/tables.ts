// Single source for Supabase table / bucket names + shared column lists, so a
// typo surfaces at the import site instead of as a runtime PGRST error.

export const TABLES = {
  analyses: 'analyses',
  profiles: 'profiles',
  financial_context: 'financial_context',        // NEW (schema-v2): demographics + brackets off profiles
  financial_snapshots: 'financial_snapshots',
  community_posts: 'community_posts',
  post_reactions: 'post_reactions',
  check_ins: 'check_ins',
  tracked_subscriptions: 'tracked_subscriptions', // was `subscriptions`
  plan_entitlements: 'plan_entitlements',         // was `user_subscriptions`
  action_plans: 'action_plans',                   // was `active_plans`
} as const;

export const BUCKETS = {
  avatars: 'avatars',
} as const;

/** Columns for the analyses/history list — used by both getAnalysisHistory and
 *  getAnalysesPage. score_label/score_color dropped (derive via getScoreBand in the frontend). */
export const HISTORY_COLUMNS = 'id, input_text, score, summary, created_at, emotional_status, share_captions';
