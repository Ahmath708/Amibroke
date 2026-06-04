import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Animated,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { selection } from '@/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommunityPost, TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Reanimated, { ZoomIn, ZoomOut, LinearTransition } from 'react-native-reanimated';
import { PlusIcon } from 'react-native-heroicons/outline';
import ProfileAvatarButton from '@/components/ProfileAvatarButton';
import { LinearGradient } from 'expo-linear-gradient';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';
import { REACTION_EMOJIS, totalReactions } from '@/utils/reactions';
import StatusPill from '@/components/StatusPill';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getCommunityFeed, getPostReactions, addReaction, removeReaction, FeedSort, FeedCursor } from '@/services/community';
import ScreenBackground from '@/components/ScreenBackground';
import ShareManagerSheet from '@/components/ShareManagerSheet';
import { useAuth } from '@/context/AuthContext';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';

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

// Score avatar = a partial-fill band-gradient ring (arc = score%), matching History.
const AVATAR = 44;
const AVATAR_STROKE = 4;
const AVATAR_R = (AVATAR - AVATAR_STROKE) / 2;
const AVATAR_CIRC = 2 * Math.PI * AVATAR_R;

export default function CommunityFeedScreen() {
  const insets = useSafeAreaInsets();
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
  const { animatedStyle } = useEntryAnimation();

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
    const [ringFrom, ringTo] = scoreGradient(post.score);
    return (
      <View style={styles.card}>
        {/* Post header */}
        <View style={styles.cardHeader}>
          <View style={styles.scoreAvatar}>
            <Svg width={AVATAR} height={AVATAR}>
              <Defs>
                <SvgGradient id={`postRing-${post.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={ringFrom} />
                  <Stop offset="100%" stopColor={ringTo} />
                </SvgGradient>
              </Defs>
              <Circle
                cx={AVATAR / 2} cy={AVATAR / 2} r={AVATAR_R}
                fill="none" stroke={Colors.backgroundSecondary} strokeWidth={AVATAR_STROKE}
              />
              <Circle
                cx={AVATAR / 2} cy={AVATAR / 2} r={AVATAR_R}
                fill="none" stroke={`url(#postRing-${post.id})`} strokeWidth={AVATAR_STROKE}
                strokeDasharray={AVATAR_CIRC}
                strokeDashoffset={AVATAR_CIRC * (1 - post.score / 100)}
                strokeLinecap="round"
                transform={`rotate(-90 ${AVATAR / 2} ${AVATAR / 2})`}
              />
            </Svg>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.scoreAvatarCenter}>
                <Text style={[styles.scoreAvatarNum, { color: scoreColor }]}>{post.score}</Text>
              </View>
            </View>
          </View>
          <View style={styles.cardMeta}>
            <View style={styles.cardUserRow}>
              <Text style={styles.cardUser}>@{post.display_name}</Text>
              {user && post.user_id === user.id && <Text style={styles.youBadge}>You</Text>}
            </View>
            <View style={styles.cardMetaRow}>
              <StatusPill label={band.label} color={scoreColor} />
              <Text style={styles.cardTime}>{timeAgo(post.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Roast */}
        <Text style={styles.roastText}>"{post.roast}"</Text>

        {/* Reactions — only emojis people have used show as chips; "+ React" opens the picker */}
        <View style={styles.reactRow}>
          {REACTION_EMOJIS.map((emoji) => {
            const count = post.reactions[emoji] || 0;
            if (count === 0) return null;
            const mine = post.my_reactions.includes(emoji);
            return (
              <Reanimated.View
                key={emoji}
                entering={ZoomIn.duration(180)}
                exiting={ZoomOut.duration(140)}
                layout={LinearTransition.duration(180)}
              >
                <TouchableOpacity
                  style={[styles.reactBtn, mine && styles.reactBtnActive]}
                  onPress={() => handleReact(post.id, emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reactEmoji}>{emoji}</Text>
                  <Text style={[styles.reactCount, mine && styles.reactCountActive]}>{count}</Text>
                </TouchableOpacity>
              </Reanimated.View>
            );
          })}
          <Reanimated.View layout={LinearTransition.duration(180)}>
            <TouchableOpacity
              style={styles.reactAddBtn}
              onPress={() => setPickerFor(pickerFor === post.id ? null : post.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactAddText}>{totalReactions(post.reactions) === 0 ? '＋ React' : '＋'}</Text>
            </TouchableOpacity>
          </Reanimated.View>
        </View>

        {/* Emoji picker (toggles a reaction; multiple allowed per user) */}
        {pickerFor === post.id && (
          <View style={styles.pickerRow}>
            {REACTION_EMOJIS.map((emoji) => {
              const mine = post.my_reactions.includes(emoji);
              return (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.pickerEmoji, mine && styles.pickerEmojiActive]}
                  onPress={() => { handleReact(post.id, emoji); setPickerFor(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="community" />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderPost}
        onEndReached={() => loadPage(false)}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primarySolid]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.largeTitle}>Community</Text>
              <ProfileAvatarButton onPress={() => navigation.navigate('Profile')} />
            </View>
            <Text style={styles.subtitle}>Anonymous financial roasts from the community 💸</Text>
            <View style={styles.segmentRow}>
              {(['trending', 'recent', 'lowest'] as FeedSort[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segment, tab === t && styles.segmentActive]}
                  onPress={() => onSelectTab(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState style={{ paddingTop: 60 }} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => loadPage(true)} />
          ) : (
            <EmptyState emoji="🌱" title="No posts yet" body="Be the first to share your roast with the community." />
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} /> : null
        }
      />

      {/* Floating share entry — opens the manager of your analyses (post/unpost) */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md }]}
        onPress={() => setManagerOpen(true)}
        activeOpacity={0.85}
        accessibilityLabel="Manage what you share"
      >
        <LinearGradient colors={Colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabInner}>
          <PlusIcon size={20} color={Colors.onAccent} />
          <Text style={styles.fabText}>Share</Text>
        </LinearGradient>
      </TouchableOpacity>

      <ShareManagerSheet
        visible={managerOpen}
        onClose={() => setManagerOpen(false)}
        onRunAnalysis={() => { setManagerOpen(false); navigation.navigate('Home'); }}
      />
    </Animated.View>
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
  subtitle: { fontFamily: Typography.fonts.body, ...Typography.subhead, color: Colors.textSecondary, marginBottom: Spacing.xl },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md,
    padding: 3, marginBottom: Spacing.xl, gap: 2,
  },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent' },
  segmentActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scoreAvatar: { width: AVATAR, height: AVATAR },
  scoreAvatarCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreAvatarNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  cardMeta: { flex: 1, gap: Spacing.xs },
  cardUserRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardUser: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  youBadge: {
    fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.primary,
    backgroundColor: Colors.primaryContainer, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: Radius.pill, overflow: 'hidden',
  },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTime: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  roastText: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize, color: Colors.textPrimary,
    lineHeight: 22, fontStyle: 'italic',
  },
  reactRow: { flexDirection: 'row', gap: Spacing.sm },
  reactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  reactBtnActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  reactEmoji: { fontSize: Typography.callout.fontSize },
  reactCount: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  reactCountActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  reactAddBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  reactAddText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  pickerRow: {
    flexDirection: 'row', alignSelf: 'flex-start', gap: Spacing.xs,
    backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  pickerEmoji: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.sm },
  pickerEmojiActive: { backgroundColor: Colors.primaryContainer },
  pickerEmojiText: { fontSize: Typography.title3.fontSize },
  fab: { position: 'absolute', right: Spacing.xl },
  fabInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingLeft: Spacing.md, paddingRight: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    shadowColor: Colors.primarySolid, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  fabText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: '#fff', fontWeight: '600' },
});
