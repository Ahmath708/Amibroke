import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AnalysisHistoryItem, TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getAnalysisHistory, getAnalysisById, getProfile } from '@/services/claudeApi';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import ScreenBackground from '@/components/ScreenBackground';
import SectionLabel from '@/components/SectionLabel';
import StatusPill from '@/components/StatusPill';
import ScoreRing from '@/components/ScoreRing';
import PremiumCard from '@/components/PremiumCard';
import CheckinCard from '@/components/CheckinCard';
import NeonButton from '@/components/NeonButton';
import LoadingState from '@/components/LoadingState';
import HomeScreen from '@/screens/HomeScreen';

type Props = { navigation: TabScreenNav<'Home'> };

// Sparkline box
const SPARK_W = 140;
const SPARK_H = 40;

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const { animatedStyle } = useEntryAnimation();

  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!user) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [profile, hist] = await Promise.all([
        getProfile(user.id),
        getAnalysisHistory(user.id),
      ]);
      setAvatarUri(profile?.avatar_url ?? null);
      setHistory(hist ?? []);
    } catch {
      // keep whatever we had
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load(!firstLoad.current);
      firstLoad.current = false;
    }, [load]),
  );

  const openAnalysis = useCallback(async (id: string) => {
    if (opening) return;
    setOpening(true);
    try {
      const analysis = await getAnalysisById(id);
      if (analysis) (navigation.navigate as any)('Results', { analysis, userInput: '' });
    } catch {
      // ignore
    } finally {
      setOpening(false);
    }
  }, [opening, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="home" />
        <LoadingState style={{ paddingTop: insets.top + 100 }} />
      </View>
    );
  }

  // First run (no analyses yet) → the full analyze input. (HomeScreen only uses
  // navigate/goBack/canGoBack, which the tab nav has; cast past the composite-vs-stack
  // dispatch type mismatch.)
  if (history.length === 0) {
    return <HomeScreen navigation={navigation as any} />;
  }

  const latest = history[0];
  const prev = history[1];
  const band = getScoreBand(latest.score);
  const delta = prev ? latest.score - prev.score : null;

  // Chronological scores for the sparkline (oldest → newest), last 8.
  const series = [...history].slice(0, 8).reverse().map((h) => h.score);
  const sMin = Math.min(...series), sMax = Math.max(...series);
  const span = Math.max(1, sMax - sMin);
  const points = series
    .map((v, i) => {
      const x = series.length === 1 ? SPARK_W / 2 : (i / (series.length - 1)) * SPARK_W;
      const y = SPARK_H - ((v - sMin) / span) * SPARK_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="home" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: wordmark + avatar → Profile */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>Am I Broke?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.avatar}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                : <Ionicons name="person" size={18} color={Colors.onAccent} />}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Score hero — focal glow on the home score */}
        <View style={styles.hero}>
          <ScoreRing score={latest.score} size={140} showOutOf glow />
          <View style={styles.heroMeta}>
            <StatusPill label={band.label} color={band.color} />
            {delta != null && delta !== 0 && (
              <View style={styles.deltaRow}>
                <Ionicons
                  name={delta > 0 ? 'arrow-up' : 'arrow-down'}
                  size={13}
                  color={delta > 0 ? Colors.success : Colors.danger}
                />
                <Text style={[styles.deltaText, { color: delta > 0 ? Colors.success : Colors.danger }]}>
                  {Math.abs(delta)} since last
                </Text>
              </View>
            )}
            <Text style={styles.checkedDate}>Checked {fmt(latest.created_at)}</Text>
          </View>
        </View>

        {/* Primary CTA */}
        <NeonButton label="New roast" onPress={() => navigation.navigate('Analyze')} style={styles.cta} />

        {/* Check-in nudge — renders itself only when a check-in is due */}
        <CheckinCard onPress={() => navigation.navigate('MonthlyCheckIn')} style={{ marginBottom: Spacing.lg }} />

        {/* Trend */}
        <View style={styles.rowLabel}>
          <SectionLabel style={{ marginBottom: 0 }}>Your Trend</SectionLabel>
          <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
            <Text style={styles.viewAll}>View all ›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('History')} style={styles.trendCard}>
          <Svg width={SPARK_W} height={SPARK_H}>
            <Polyline points={points} fill="none" stroke={band.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
          <View style={styles.trendNums}>
            <Text style={styles.trendEnd}>{series[0]}</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} />
            <Text style={[styles.trendEnd, { color: band.color }]}>{series[series.length - 1]}</Text>
          </View>
        </TouchableOpacity>

        {/* Premium card */}
        {tier === 'deep_dive' ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Tools')} style={styles.toolsCard}>
            <View style={styles.toolsIcon}><Ionicons name="construct" size={18} color={Colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolsTitle}>Your plan & tools</Text>
              <Text style={styles.toolsSub}>Action plan · debt payoff · scenarios</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <PremiumCard
            variant={tier === 'action_plan' ? 'upgrade' : 'go'}
            onPress={() => navigation.navigate('Paywall')}
            style={{ marginBottom: Spacing.lg }}
          />
        )}

        {/* Recent */}
        <View style={styles.rowLabel}>
          <SectionLabel style={{ marginBottom: 0 }}>Recent</SectionLabel>
          <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
            <Text style={styles.viewAll}>View all ›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.recentGroup}>
          {history.slice(0, 2).map((h, i) => {
            const c = getScoreBand(h.score).color;
            return (
              <React.Fragment key={h.id}>
                {i > 0 && <View style={styles.recentSep} />}
                <TouchableOpacity style={styles.recentRow} onPress={() => openAnalysis(h.id)} activeOpacity={0.7} disabled={opening}>
                  <Text style={[styles.recentScore, { color: c }]}>{h.score}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentLabel}>{h.score_label}</Text>
                    <Text style={styles.recentDate}>{fmt(h.created_at)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const card = {
  backgroundColor: Colors.surfaceElevated,
  borderRadius: Radius.lg,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: Colors.glassBorderLight,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  wordmark: { ...Typography.title1, fontFamily: Typography.fonts.heading, color: Colors.textPrimary },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  hero: { alignItems: 'center', marginBottom: Spacing.xl },
  heroMeta: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  deltaText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize },
  checkedDate: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  cta: { marginBottom: Spacing.lg },
  rowLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  viewAll: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.tint },
  trendCard: { ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, marginBottom: Spacing.lg },
  trendNums: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trendEnd: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textSecondary },
  toolsCard: { ...card, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.lg },
  toolsIcon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  toolsTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  toolsSub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
  recentGroup: { ...card, overflow: 'hidden' },
  recentSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.lg },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 56 },
  recentScore: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', width: 40 },
  recentLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  recentDate: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
});
