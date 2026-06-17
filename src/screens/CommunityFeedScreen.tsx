import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { enterUp, PressableScale } from '@/components/motion';
import { selection } from '@/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useScrollToTopFast } from '@/hooks/useScrollToTopFast';
import { CommunityPost, TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Durations } from '@/theme/motion';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import Reanimated, { ZoomIn, ZoomOut, LinearTransition } from 'react-native-reanimated';
import NotificationBell from '@/components/NotificationBell';
import Fab from '@/components/Fab';
import { getScoreBand } from '@shared/scoring/bands.ts';
import MiniScoreRing from '@/components/MiniScoreRing';
import { REACTION_EMOJIS, totalReactions } from '@/utils/reactions';
import BandPill from '@/components/BandPill';
import Skeleton from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getCommunityFeed, getPostReactions, addReaction, removeReaction, FeedSort, FeedCursor } from '@/services/community';
import ScreenBackground from '@/components/ScreenBackground';
import ShareManagerSheet from '@/components/ShareManagerSheet';
import TopScrim from '@/components/TopScrim';
import { useAuth } from '@/context/AuthContext';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const PAGE_SIZE = 20;


export default function CommunityFeedScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<FlatList<any>>(null);
  const onScroll = useScrollToTopFast(scrollRef); // re-tap the active tab → scroll to top (snappy)
  const { user } = useAuth();
  const navigation = useNavigation<TabScreenNav<'Community'>>();
  const [tab, setTab] = useState<FeedSort>('recent');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);        // initial paint
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null); // post id whose emoji picker is open
  const [managerOpen, setManagerOpen] = useState(false);           // share-manager sheet
  const loadingRef = useRef(false);                    // guards concurrent page loads
  const pendingRef = useRef<Set<string>>(new Set());   // `${postId}:${emoji}` reactions in flight

  // Load one page. reset → page 1 of `sort`; otherwise append the next keyset page.
  const loadPage = useCallback(async (reset: boolean, sortOverride?: FeedSort) => {
    if (loadingRef.current) return;
    if (!reset && !hasMore) return;
    const sort = sortOverride ?? tab;
    loadingRef.current = true;
    if (reset) setError(null); else setLoadingMore(true);
    const page = await getCommunityFeed({ sort, userId: user?.id, cursor: reset ? null : cursor, limit: PAGE_SIZE });
    setPosts((prev) => {
      if (reset) return page.posts;
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...page.posts.filter((p) => !seen.has(p.id))]; // dedupe at the cursor boundary
    });
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
    loadingRef.current = false;
  }, [tab, cursor, hasMore, user]);

  // Refetch page 1 whenever the screen regains focus — bounds how stale the
  // (non-realtime) counts can get to "fresh as of when you last opened the tab."
  // A ref to the latest loadPage avoids a stale closure capturing an old tab/cursor.
  const loadPageRef = useRef(loadPage);
  useEffect(() => { loadPageRef.current = loadPage; }, [loadPage]);
  useFocusEffect(useCallback(() => { loadPageRef.current(true); }, []));

  const onRefresh = () => { setRefreshing(true); loadPage(true); };

  // Patch a single post's reactions from the server (no full-feed reset / scroll loss).
  const syncPost = async (postId: string) => {
    const fresh = await getPostReactions(postId, user?.id);
    if (!fresh) return;
    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, reactions: fresh.reactions, my_reactions: fresh.my_reactions } : p));
  };

  const onSelectTab = (t: FeedSort) => {
    if (t === tab || loadingRef.current) return;
    setTab(t);
    setPosts([]); setCursor(null); setHasMore(true); setLoading(true);
    loadPage(true, t); // pass the new sort directly — `tab` state hasn't flushed yet
  };

  const handleReact = (postId: string, emoji: string) => {
    if (!user) return;
    const key = `${postId}:${emoji}`;
    if (pendingRef.current.has(key)) return; // ignore taps while this emoji's write is in flight
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const adding = !post.my_reactions.includes(emoji);
    selection();
    pendingRef.current.add(key);

    // Optimistic: flip local state immediately so the tap feels instant. The DB
    // trigger recomputes the real count, so our ±1 matches what the server will store.
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const count = Math.max(0, (p.reactions[emoji] || 0) + (adding ? 1 : -1));
      return {
        ...p,
        reactions: { ...p.reactions, [emoji]: count },
        my_reactions: adding ? [...p.my_reactions, emoji] : p.my_reactions.filter((e) => e !== emoji),
      };
    }));

    // Persist in the background. On failure (e.g. a 23505 "already reacted" from a
    // race), patch just this post from the server — never reset the paginated feed.
    const persist = adding ? addReaction(postId, user.id, emoji) : removeReaction(postId, user.id, emoji);
    persist
      .then((ok) => { if (!ok) return syncPost(postId); })
      .catch(() => { console.warn('Failed to update reaction'); return syncPost(postId); })
      .finally(() => { pendingRef.current.delete(key); });
  };

  const renderPost = ({ item: post }: { item: CommunityPost }) => {
    const band = getScoreBand(post.score); // live band — label + color always agree
    const scoreColor = band.color;
    return (
      <View style={styles.card}>
        {/* Post header */}
        <View style={styles.cardHeader}>
          <MiniScoreRing score={post.score} size={44} stroke={4} numberSize={Typography.subhead.fontSize} />
          <View style={styles.cardMeta}>
            <View style={styles.cardUserRow}>
              <Text style={styles.cardUser} numberOfLines={1}>@{post.display_name}</Text>
              {user && post.user_id === user.id && <Text style={styles.youBadge}>You</Text>}
            </View>
            <View style={styles.cardMetaRow}>
              <BandPill label={band.label} color={scoreColor} size="sm" />
              <Text style={styles.cardTime}>{timeAgo(post.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Roast */}
        <Text style={styles.roastText} numberOfLines={6}>"{post.roast}"</Text>

        {/* Reactions — only emojis people have used show as chips; "+ React" opens the picker */}
        <View style={styles.reactRow}>
          {REACTION_EMOJIS.map((emoji) => {
            const count = post.reactions[emoji] || 0;
            if (count === 0) return null;
            const mine = post.my_reactions.includes(emoji);
            return (
              <Reanimated.View
                key={emoji}
                entering={ZoomIn.duration(Durations.fast)}
                exiting={ZoomOut.duration(Durations.fast)}
                layout={LinearTransition.duration(Durations.fast)}
              >
                <PressableScale
                  style={[styles.reactBtn, mine && styles.reactBtnActive]}
                  onPress={() => handleReact(post.id, emoji)}
                >
                  <Text style={styles.reactEmoji}>{emoji}</Text>
                  <Text style={[styles.reactCount, mine && styles.reactCountActive]}>{count}</Text>
                </PressableScale>
              </Reanimated.View>
            );
          })}
          <Reanimated.View layout={LinearTransition.duration(Durations.fast)}>
            <PressableScale
              style={styles.reactAddBtn}
              onPress={() => setPickerFor(pickerFor === post.id ? null : post.id)}
            >
              <Text style={styles.reactAddText}>{totalReactions(post.reactions) === 0 ? '＋ React' : '＋'}</Text>
            </PressableScale>
          </Reanimated.View>
        </View>

        {/* Emoji picker (toggles a reaction; multiple allowed per user) */}
        {pickerFor === post.id && (
          <View style={styles.pickerRow}>
            {REACTION_EMOJIS.map((emoji) => {
              const mine = post.my_reactions.includes(emoji);
              return (
                <PressableScale
                  key={emoji}
                  style={[styles.pickerEmoji, mine && styles.pickerEmojiActive]}
                  onPress={() => { handleReact(post.id, emoji); setPickerFor(null); }}
                >
                  <Text style={styles.pickerEmojiText}>{emoji}</Text>
                </PressableScale>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <Reanimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="community" />
      <FlatList
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderPost}
        onEndReached={() => loadPage(false)}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accentSolid]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.largeTitle}>Community</Text>
              <NotificationBell />
            </View>
            <Text style={styles.subtitle}>Everyone's a little broke. Anonymous roasts and scores from people figuring it out too.</Text>
            <View style={styles.segmentRow}>
              {(['trending', 'recent', 'lowest'] as FeedSort[]).map((t) => (
                <PressableScale
                  key={t}
                  style={[styles.segment, tab === t && styles.segmentActive]}
                  onPress={() => onSelectTab(t)}
                >
                  <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: Spacing.md, paddingTop: Spacing.sm }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height={120} radius={Radius.lg} />
              ))}
            </View>
          ) : error ? (
            <ErrorState message={error} onRetry={() => loadPage(true)} />
          ) : (
            <EmptyState emoji="🌱" title="No posts yet" body="Be the first to share your roast with the community." />
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.xl }} /> : null
        }
      />

      {/* Floating share entry — opens the manager of your analyses (post/unpost) */}
      <Fab label="Share" onPress={() => setManagerOpen(true)} accessibilityLabel="Manage what you share" />

      <ShareManagerSheet
        visible={managerOpen}
        onClose={() => setManagerOpen(false)}
        onRunAnalysis={() => { setManagerOpen(false); navigation.navigate('Home'); }}
      />

      <TopScrim variant="community" />
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  largeTitle: {
    fontFamily: Typography.fonts.heading, ...Typography.screenTitle,
    color: Colors.textPrimary,
  },
  subtitle: { fontFamily: Typography.fonts.body, ...Typography.subhead, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  // Segmented control (Claude Design seg-ctrl): tinted track + accent-washed active segment.
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary, borderRadius: 13,
    padding: 4, marginBottom: Spacing.lg, gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  segment: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  segmentActive: { backgroundColor: Colors.accentContainer },
  segmentText: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, color: Colors.textSecondary, letterSpacing: -0.2 },
  segmentTextActive: { color: Colors.accent },
  card: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 18, padding: 16, marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardMeta: { flex: 1, gap: Spacing.xs },
  cardUserRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  cardUser: { fontFamily: Typography.fonts.bodySemi, fontSize: 14.5, color: Colors.textPrimary, letterSpacing: -0.2 },
  youBadge: {
    fontFamily: Typography.fonts.extrabold, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: Colors.accent,
    backgroundColor: Colors.accentContainer, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.sm, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder,
  },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  cardTime: { fontFamily: Typography.fonts.mono, fontSize: 12, color: Colors.textTertiary },
  roastText: {
    fontFamily: Typography.fonts.body,
    fontSize: 14.5, color: 'rgba(255,255,255,0.82)',
    lineHeight: 22, fontStyle: 'italic',
  },
  reactRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  reactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.backgroundTertiary, height: 32,
    borderRadius: Radius.pill, paddingHorizontal: 11,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  reactBtnActive: { backgroundColor: Colors.accentContainer, borderColor: Colors.accentBorder },
  reactEmoji: { fontSize: 14 },
  reactCount: { fontFamily: Typography.fonts.mono, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  reactCountActive: { color: Colors.accent },
  reactAddBtn: {
    flexDirection: 'row', alignItems: 'center', height: 32,
    borderRadius: Radius.pill, paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, borderStyle: 'dashed',
  },
  reactAddText: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, color: Colors.textSecondary },
  pickerRow: {
    flexDirection: 'row', alignSelf: 'flex-start', gap: Spacing.xs,
    backgroundColor: Colors.backgroundTertiary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  pickerEmoji: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.sm },
  pickerEmojiActive: { backgroundColor: Colors.accentContainer },
  pickerEmojiText: { fontSize: Typography.title3.fontSize },
});
