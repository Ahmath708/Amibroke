import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import StatusPill from '../components/StatusPill';

const FEED = [
  { id: '1', user: 'anon_rent_too_high', score: 34, label: 'Financially Fragile', roast: 'Your coffee budget is larger than your emergency fund. Impressive.', time: '2m', reactions: { fire: 142, cry: 58, skull: 91 } },
  { id: '2', user: 'anon_crypto_regrets', score: 61, label: 'Getting By', roast: 'You\'re spending $340/month on subscriptions you use maybe twice a year.', time: '18m', reactions: { fire: 88, cry: 201, skull: 34 } },
  { id: '3', user: 'anon_debtfree_soon', score: 78, label: 'Doing Alright', roast: 'Actually solid. You\'re saving 18% of income. The bar is low but you\'re above it.', time: '1h', reactions: { fire: 312, cry: 12, skull: 8 } },
  { id: '4', user: 'anon_yolo_spending', score: 22, label: 'Financial Crisis', roast: 'You have -$180 in savings each month. That\'s not a budget, that\'s a countdown timer.', time: '3h', reactions: { fire: 445, cry: 88, skull: 201 } },
  { id: '5', user: 'anon_side_hustle', score: 69, label: 'Getting By', roast: 'Side hustle income is masking your core problem: expenses grow as fast as revenue.', time: '5h', reactions: { fire: 67, cry: 43, skull: 22 } },
];

type TabType = 'trending' | 'recent' | 'lowest';

export default function CommunityFeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<TabType>('trending');
  const [reactions, setReactions] = useState<Record<string, string | null>>({});

  const react = (postId: string, emoji: string) => {
    setReactions((prev) => ({ ...prev, [postId]: prev[postId] === emoji ? null : emoji }));
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title */}
        <Text style={styles.largeTitle}>Community</Text>
        <Text style={styles.subtitle}>Anonymous financial roasts from the community 👀</Text>

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

        {/* Feed */}
        {FEED.map((post) => {
          const scoreColor = post.score < 40 ? Colors.danger : post.score < 65 ? Colors.warning : Colors.success;
          const variant = post.score < 40 ? 'danger' : post.score < 65 ? 'warning' : 'good';
          const myReaction = reactions[post.id];

          return (
            <View key={post.id} style={styles.card}>
              {/* Post header */}
              <View style={styles.cardHeader}>
                <View style={[styles.scoreAvatar, { borderColor: scoreColor }]}>
                  <Text style={[styles.scoreAvatarNum, { color: scoreColor }]}>{post.score}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardUser}>@{post.user}</Text>
                  <View style={styles.cardMetaRow}>
                    <StatusPill label={post.label} variant={variant} />
                    <Text style={styles.cardTime}>{post.time} ago</Text>
                  </View>
                </View>
              </View>

              {/* Roast */}
              <Text style={styles.roastText}>"{post.roast}"</Text>

              {/* Reactions */}
              <View style={styles.reactRow}>
                {[
                  { emoji: '🔥', key: 'fire', count: post.reactions.fire },
                  { emoji: '😭', key: 'cry', count: post.reactions.cry },
                  { emoji: '💀', key: 'skull', count: post.reactions.skull },
                ].map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.reactBtn, myReaction === r.emoji && styles.reactBtnActive]}
                    onPress={() => react(post.id, r.emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactCount, myReaction === r.emoji && styles.reactCountActive]}>
                      {r.count + (myReaction === r.emoji ? 1 : 0)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {/* Submit your own */}
        <View style={styles.submitCard}>
          <Text style={styles.submitTitle}>Share your roast</Text>
          <Text style={styles.submitBody}>Run an analysis to get your anonymous score added to the feed.</Text>
          <TouchableOpacity style={styles.submitBtn} activeOpacity={0.85} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.submitBtnText}>Run My Analysis →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  largeTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: 34, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: 0.37, marginBottom: 4,
  },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, marginBottom: 20 },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md,
    padding: 3, marginBottom: 20, gap: 2,
  },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Colors.groupedRow },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  card: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: 16, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreAvatar: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreAvatarNum: { fontFamily: Typography.fonts.heading, fontSize: 15, fontWeight: '700' },
  cardMeta: { flex: 1, gap: 4 },
  cardUser: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTime: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted },
  roastText: {
    fontFamily: Typography.fonts.body,
    fontSize: 15, color: Colors.textPrimary,
    lineHeight: 22, fontStyle: 'italic',
  },
  reactRow: { flexDirection: 'row', gap: 8 },
  reactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  reactBtnActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  reactEmoji: { fontSize: 14 },
  reactCount: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
  reactCountActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  submitCard: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.lg, padding: 18, marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    gap: 6,
  },
  submitTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: 17, color: Colors.textPrimary, fontWeight: '600' },
  submitBody: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  submitBtn: { marginTop: 6, alignSelf: 'flex-start' },
  submitBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.primary, fontWeight: '500' },
});
