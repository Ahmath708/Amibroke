import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Animated,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommunityPost, TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';
import { REACTION_EMOJIS, totalReactions } from '@/utils/reactions';
import StatusPill from '@/components/StatusPill';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getCommunityFeed, addReaction, removeReaction } from '@/services/claudeApi';
import ScreenBackground from '@/components/ScreenBackground';
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

type TabType = 'trending' | 'recent' | 'lowest';

// Score avatar = a partial-fill band-gradient ring (arc = score%), matching History.
const AVATAR = 44;
const AVATAR_STROKE = 4;
const AVATAR_R = (AVATAR - AVATAR_STROKE) / 2;
const AVATAR_CIRC = 2 * Math.PI * AVATAR_R;

export default function CommunityFeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<TabScreenNav<'Community'>>();
  const [tab, setTab] = useState<TabType>('recent');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null); // post id whose emoji picker is open
  const { animatedStyle } = useEntryAnimation();

  const fetchFeed = useCallback(async () => {
    setError(null);
    try {
      const data = await getCommunityFeed(user?.id);
      setPosts(data);
    } catch {
      setError('Failed to load feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeed();
  }, [fetchFeed]);

  const handleReact = async (postId: string, emoji: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    try {
      if (post.my_reactions.includes(emoji)) {
        await removeReaction(postId, user.id, emoji);
      } else {
        await addReaction(postId, user.id, emoji);
      }
    } catch {
      console.warn('Failed to update reaction');
    }
    fetchFeed();
  };

  const sorted = [...posts];
  // Trending = most-reacted, with newer posts winning ties so the tab stays fresh.
  if (tab === 'trending') sorted.sort((a, b) => {
    const diff = totalReactions(b.reactions) - totalReactions(a.reactions);
    return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  if (tab === 'lowest') sorted.sort((a, b) => a.score - b.score);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="community" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primarySolid]}
          />
        }
      >
        {/* Large title */}
        <Text style={styles.largeTitle}>Community</Text>
        <Text style={styles.subtitle}>Anonymous financial roasts from the community 💸</Text>

        {/* Segmented control */}
        <View style={styles.segmentRow}>
          {(['trending', 'recent', 'lowest'] as TabType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.segment, tab === t && styles.segmentActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <LoadingState style={{ paddingTop: 60 }} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchFeed} />
        ) : sorted.length === 0 ? (
          <EmptyState emoji="🌱" title="No posts yet" body="Be the first to share your roast with the community." />
        ) : (
          sorted.map((post) => {
            const band = getScoreBand(post.score); // live band — label + color always agree
            const scoreColor = band.color;
            const [ringFrom, ringTo] = scoreGradient(post.score);

            return (
              <View key={post.id} style={styles.card}>
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
                    <Text style={styles.cardUser}>@{post.display_name}</Text>
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
                      <TouchableOpacity
                        key={emoji}
                        style={[styles.reactBtn, mine && styles.reactBtnActive]}
                        onPress={() => handleReact(post.id, emoji)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.reactEmoji}>{emoji}</Text>
                        <Text style={[styles.reactCount, mine && styles.reactCountActive]}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.reactAddBtn}
                    onPress={() => setPickerFor(pickerFor === post.id ? null : post.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactAddText}>{totalReactions(post.reactions) === 0 ? '＋ React' : '＋'}</Text>
                  </TouchableOpacity>
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
          })
        )}

        {/* Submit your own */}
        <View style={styles.submitCard}>
          <Text style={styles.submitTitle}>Share your roast</Text>
          <Text style={styles.submitBody}>Run an analysis to get your anonymous score added to the feed.</Text>
          <TouchableOpacity style={styles.submitBtn} activeOpacity={0.85} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.submitBtnText}>Run My Analysis →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  largeTitle: {
    fontFamily: Typography.fonts.heading, ...Typography.largeTitle,
    color: Colors.textPrimary, marginBottom: Spacing.xs,
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
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scoreAvatar: { width: AVATAR, height: AVATAR },
  scoreAvatarCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreAvatarNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  cardMeta: { flex: 1, gap: Spacing.xs },
  cardUser: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, fontWeight: '500' },
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
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
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
  submitCard: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.lg, padding: Spacing.lg + 2, marginTop: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    gap: 6,
  },
  submitTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, fontWeight: '600' },
  submitBody: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  submitBtn: { marginTop: 6, alignSelf: 'flex-start' },
  submitBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.primary, fontWeight: '500' },
});
