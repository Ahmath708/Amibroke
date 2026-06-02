/**
 * Community reaction emoji set — MUST match the post_reactions emoji CHECK
 * constraint (supabase/migrations/00011). The DB stores community_posts.reactions
 * as an emoji-keyed JSONB map ({ "🔥": 3, "😭": 1, ... }), so the app keys off the
 * emoji character, not a name.
 */
export const REACTION_EMOJIS = ['🔥', '😭', '💀', '💯', '😂'] as const;

/** Total reactions on a post — sums the known emoji counts, ignoring any legacy keys. */
export function totalReactions(reactions: Record<string, number> | null | undefined): number {
  if (!reactions) return 0;
  return REACTION_EMOJIS.reduce((sum, e) => sum + (reactions[e] || 0), 0);
}
