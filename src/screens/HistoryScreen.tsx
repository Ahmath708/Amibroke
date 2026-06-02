import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Animated,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';
import GlassCard from '@/components/GlassCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import SectionLabel from '@/components/SectionLabel';
import AnalysisRow from '@/components/AnalysisRow';
import { getAnalysisHistory, getCheckIns, getAnalysisById } from '@/services/claudeApi';
import { AnalysisHistoryItem, CheckIn } from '@/types';
import ScreenBackground from '@/components/ScreenBackground';
import HistoryChart from '@/components/HistoryChart';
import CheckinTrend from '@/components/CheckinTrend';
import { Granularity, itemsInPeriod } from '@/utils/historyChart';
import { useAuth } from '@/context/AuthContext';

// Inline analyses shown under the chart before the "View All" link.
const INLINE_LIMIT = 5;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowLoading, setRowLoading] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [now] = useState<Date>(() => new Date());
  const { animatedStyle } = useEntryAnimation();

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [data, checkinData] = await Promise.all([
        getAnalysisHistory(user.id),
        getCheckIns(user.id),
      ]);
      setHistory(data || []);
      setCheckIns(checkinData || []);
    } catch {
      setError('Failed to load history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Open the chart on the period containing the most recent analysis (once),
  // so the default view always lands on data regardless of the device clock.
  const anchorInited = useRef(false);
  useEffect(() => {
    if (!anchorInited.current && history.length > 0) {
      anchorInited.current = true;
      setAnchor(new Date(history[0].created_at));
    }
  }, [history]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  const handleRowPress = async (id: string) => {
    if (rowLoading) return;
    setRowLoading(id);
    try {
      const analysis = await getAnalysisById(id);
      if (analysis) {
        navigation.navigate('Results', { analysis, userInput: '' });
      }
    } catch {
      // silently ignore
    } finally {
      setRowLoading(null);
    }
  };

  // Deltas are computed against the full chronological history (descending), so a
  // row's "vs previous" stays correct even when the list is filtered to a period.
  const deltaById = new Map<string, number>();
  history.forEach((h, i) => {
    if (i < history.length - 1) deltaById.set(h.id, h.score - history[i + 1].score);
  });
  const periodItems = itemsInPeriod(granularity, anchor, history);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingState style={{ paddingTop: insets.top + 80 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={fetchHistory} style={{ paddingTop: insets.top + 80 }} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="history" />
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
        <Text style={styles.largeTitle}>History</Text>
        {user ? (
          <Text style={styles.subtitle}>{history.length} {history.length === 1 ? 'analysis' : 'analyses'}</Text>
        ) : (
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.subtitle, styles.signInLink]}>Sign in to track your progress →</Text>
          </TouchableOpacity>
        )}
        {history.length > 0 && history.some((h) => !h.score_label) && (
          <Text style={styles.versionNote}>Older analyses shown with limited data</Text>
        )}

        {history.length === 0 ? (
          <EmptyState emoji="📋" title="No analyses yet" body="Run your first analysis to start tracking your financial progress over time." />
        ) : (
          <>
            {/* Filterable chart */}
            <SectionLabel>Score Trend</SectionLabel>
            <HistoryChart
              items={history}
              granularity={granularity}
              anchor={anchor}
              now={now}
              onChange={(g, a) => { setGranularity(g); setAnchor(a); }}
              onOpenAnalysis={handleRowPress}
            />

            {/* List — scoped to the chart's current period, capped; full archive via "View All" */}
            <SectionLabel>Analyses</SectionLabel>
            {periodItems.length === 0 ? (
              <Text style={styles.periodEmpty}>No analyses in this period.</Text>
            ) : (
              <View style={styles.historyGroup}>
                {periodItems.slice(0, INLINE_LIMIT).map((h, i) => (
                  <React.Fragment key={h.id}>
                    {i > 0 && <View style={styles.rowSep} />}
                    <AnalysisRow
                      item={h}
                      delta={deltaById.get(h.id)}
                      loading={rowLoading === h.id}
                      disabled={!!rowLoading}
                      onPress={() => handleRowPress(h.id)}
                    />
                  </React.Fragment>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.viewAll} activeOpacity={0.7} onPress={() => navigation.navigate('AllAnalyses')}>
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>

            {/* Progress trend across check-ins (self-hides until there's data) */}
            <CheckinTrend />

            {/* Check-ins list */}
            {checkIns.length > 0 && (
              <>
                <SectionLabel style={{ marginTop: Spacing.xl }}>Monthly Check-Ins</SectionLabel>
                <View style={styles.historyGroup}>
                  {checkIns.map((c, i) => {
                    const MOODS = ['😭', '😟', '😐', '🙂', '🤑'];
                    return (
                      <React.Fragment key={c.id}>
                        {i > 0 && <View style={styles.rowSep} />}
                        <View style={styles.historyRow}>
                          <View style={styles.checkinEmoji}>
                            <Text style={styles.checkinEmojiText}>{MOODS[c.mood] || '😐'}</Text>
                          </View>
                          <View style={styles.historyInfo}>
                            <Text style={styles.historyDate}>{fmtDate(c.created_at)}</Text>
                            {c.notes ? (
                              <Text style={styles.historySummary} numberOfLines={2}>
                                "{c.notes}"
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            )}

            <TouchableOpacity onPress={() => navigation.navigate('MonthlyCheckIn')} style={styles.newCheckinBtn} activeOpacity={0.8}>
              <Text style={styles.newCheckinText}>+ New check-in</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: Spacing.xl },
  largeTitle: {
    fontFamily: Typography.fonts.heading,
    ...Typography.largeTitle,
    color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xxl },
  signInLink: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  versionNote: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginBottom: Spacing.lg, fontStyle: 'italic' },
  periodEmpty: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, paddingVertical: Spacing.lg, textAlign: 'center' },
  viewAll: { alignSelf: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  viewAllText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, color: Colors.primary, fontWeight: '600' },
  newCheckinBtn: {
    marginTop: Spacing.lg, alignItems: 'center', justifyContent: 'center',
    minHeight: 44, paddingVertical: Spacing.md,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.primary,
    backgroundColor: Colors.primaryContainer,
  },
  newCheckinText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.primary },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  historyGroup: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 70 },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  historyInfo: { flex: 1, gap: Spacing.xs },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  historyDate: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  historyVerdict: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, fontWeight: '600', flexShrink: 1 },
  historyDelta: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, fontWeight: '600' },
  historySummary: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18, marginTop: Spacing.xs / 2 },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '300' },
  checkinEmoji: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  checkinEmojiText: { fontSize: Typography.title2.fontSize },
  historyEmoji: { fontSize: Typography.subhead.fontSize, marginLeft: 2 },
  historyBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  historyBadge: {
    fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption2.fontSize, color: Colors.primary,
    backgroundColor: Colors.primaryContainer, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radius.pill, overflow: 'hidden',
  },
});
