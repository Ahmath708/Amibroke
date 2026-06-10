// Community feed — keyset-paginated post listing, sharing/unsharing a roast, and
// reactions (Supabase `community_posts` + `post_reactions` tables).
import { CommunityPost } from '@/types';
import { TABLES } from './tables';
import { withClient } from './supabaseClient';
import { getProfile } from './profile';
import { USE_AI_MOCKS } from '@/config/ai';

export type FeedSort = 'recent' | 'trending' | 'lowest';
/** Opaque keyset cursor — the caller just stores it and passes it back. */
export interface FeedCursor { createdAt: string; score: number; count: number; }
export interface FeedPage { posts: CommunityPost[]; nextCursor: FeedCursor | null; hasMore: boolean; }

/**
 * One page of the community feed, ordered + keyset-paginated server-side per tab:
 *   recent   → created_at DESC                       (created_at is the unique cursor)
 *   lowest   → score ASC, created_at ASC             (composite — score has heavy ties)
 *   trending → reaction_count DESC, created_at DESC  (composite — counts have heavy ties)
 * Fetches limit+1 to detect `hasMore` with no count query. created_at is double-quoted
 * inside the composite .or() so its timezone "+" survives URL encoding.
 */
export async function getCommunityFeed(
  opts: { sort?: FeedSort; userId?: string; cursor?: FeedCursor | null; limit?: number } = {},
): Promise<FeedPage> {
  const { sort = 'recent', userId, cursor = null, limit = 20 } = opts;
  const empty: FeedPage = { posts: [], nextCursor: null, hasMore: false };
  if (USE_AI_MOCKS) {
    const { MOCK_FEED } = require('@/__fixtures__/mockFeed');
    const reactSum = (p: CommunityPost) => Object.values(p.reactions).reduce((s, n) => s + (n as number), 0);
    const posts: CommunityPost[] = [...MOCK_FEED];
    if (sort === 'lowest') posts.sort((a, b) => a.score - b.score);
    else if (sort === 'trending') posts.sort((a, b) => reactSum(b) - reactSum(a));
    else posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { posts, nextCursor: null, hasMore: false };
  }
  return withClient('fetch community feed', empty, async (client) => {
    let query = (client as any).from(TABLES.community_posts).select('*');

    if (sort === 'lowest') {
      query = query.order('score', { ascending: true }).order('created_at', { ascending: true });
      if (cursor) query = query.or(`score.gt.${cursor.score},and(score.eq.${cursor.score},created_at.gt."${cursor.createdAt}")`);
    } else if (sort === 'trending') {
      query = query.order('reaction_count', { ascending: false }).order('created_at', { ascending: false });
      if (cursor) query = query.or(`reaction_count.lt.${cursor.count},and(reaction_count.eq.${cursor.count},created_at.lt."${cursor.createdAt}")`);
    } else {
      query = query.order('created_at', { ascending: false });
      if (cursor) query = query.lt('created_at', cursor.createdAt);
    }
    query = query.limit(limit + 1);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    let posts: CommunityPost[] = pageRows.map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      display_name: p.display_name,
      score: p.score,
      score_label: p.score_label,
      roast: p.roast,
      summary: p.summary,
      reactions: p.reactions || {},
      created_at: p.created_at,
      my_reactions: [],
    }));

    if (userId && posts.length) {
      const ids = posts.map((p) => p.id);
      const { data: myReactions } = await (client as any)
        .from(TABLES.post_reactions)
        .select('post_id, emoji')
        .eq('user_id', userId)
        .in('post_id', ids);
      const reactMap: Record<string, string[]> = {};
      (myReactions || []).forEach((r: any) => { (reactMap[r.post_id] ||= []).push(r.emoji); });
      posts = posts.map((p) => ({ ...p, my_reactions: reactMap[p.id] || [] }));
    }

    const last: any = pageRows[pageRows.length - 1];
    const nextCursor: FeedCursor | null = hasMore && last
      ? { createdAt: last.created_at, score: last.score, count: last.reaction_count ?? 0 }
      : null;

    return { posts, nextCursor, hasMore };
  });
}

/** Authoritative reaction state for a single post — used to patch one card after an
 *  optimistic reaction fails, without resetting the whole paginated feed. */
export async function getPostReactions(
  postId: string,
  userId?: string,
): Promise<{ reactions: Record<string, number>; my_reactions: string[] } | null> {
  return withClient<{ reactions: Record<string, number>; my_reactions: string[] } | null>('fetch post reactions', null, async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.community_posts)
      .select('reactions')
      .eq('id', postId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    let my_reactions: string[] = [];
    if (userId) {
      const { data: mine } = await (client as any)
        .from(TABLES.post_reactions)
        .select('emoji')
        .eq('post_id', postId)
        .eq('user_id', userId);
      my_reactions = (mine || []).map((r: any) => r.emoji);
    }
    return { reactions: data.reactions || {}, my_reactions };
  });
}

export async function shareToFeed(
  userId: string,
  analysisId: string,
  score: number,
  scoreLabel: string,
  roast: string,
  summary: string,
  shareCaptions?: any[],
): Promise<string | null> {
  return withClient('share to feed', null, async (client) => {
    const profile = await getProfile(userId);
    // Real handle (not anonymized) — the feed renders it as @display_name.
    const displayName = profile?.username ?? `user_${userId.slice(0, 8)}`;
    const { data, error } = await (client as any)
      .from(TABLES.community_posts)
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        display_name: displayName,
        score,
        score_label: scoreLabel,
        roast,
        summary,
        share_captions: shareCaptions || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  });
}

/** Analysis IDs the user currently has live in the community feed (drives the share manager toggles). */
export async function getMySharedAnalysisIds(userId: string): Promise<string[]> {
  return withClient('fetch shared analysis ids', [], async (client) => {
    const { data, error } = await (client as any)
      .from(TABLES.community_posts)
      .select('analysis_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((r: any) => r.analysis_id).filter(Boolean);
  });
}

/** Remove the user's post for an analysis from the feed (RLS allows deleting own posts;
 *  post_reactions cascade-delete, so reactions are lost — re-sharing starts fresh). */
export async function unshareFromFeed(analysisId: string, userId: string): Promise<boolean> {
  return withClient('unshare from feed', false, async (client) => {
    const { error } = await (client as any)
      .from(TABLES.community_posts)
      .delete()
      .eq('analysis_id', analysisId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  });
}

export async function addReaction(postId: string, userId: string, emoji: string): Promise<boolean> {
  return withClient('add reaction', false, async (client) => {
    const { error } = await (client as any)
      .from(TABLES.post_reactions)
      .insert({ post_id: postId, user_id: userId, emoji });
    if (error?.code === '23505') return false; // already reacted — not an error
    if (error) throw error;
    return true;
  });
}

export async function removeReaction(postId: string, userId: string, emoji: string): Promise<boolean> {
  return withClient('remove reaction', false, async (client) => {
    const { error } = await (client as any)
      .from(TABLES.post_reactions)
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    if (error) throw error;
    return true;
  });
}
