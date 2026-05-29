import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Animated,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { getAnalysisHistory, getCheckIns, getAnalysisById } from '@/services/claudeApi';
import { AnalysisHistoryItem, CheckIn } from '@/types';
import ScreenBackground from '@/components/ScreenBackground';
import { useAuth } from '@/context/AuthContext';

const MAX_SCORE = 100;

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

  const barData = [...history].reverse();

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
        {history.length > 0 && (
          <Text style={styles.versionNote}>
            {history.some((h) => !h.score_label) ? 'Older analyses shown with limited data' : ''}
          </Text>
        )}

        {history.length === 0 ? (
          <EmptyState emoji="📋" title="No analyses yet" body="Run your first analysis to start tracking your financial progress over time." />
        ) : (
          <>
            {/* Chart card */}
            {barData.length > 1 && (
              <GlassCard style={styles.chartCard}>
                <Text style={styles.chartTitle}>Score Over Time</Text>
                <View style={styles.chart}>
                  {barData.map((item: AnalysisHistoryItem) => {
                    const barH = (item.score / MAX_SCORE) * 100;
                    const color = item.score < 40 ? Colors.danger : item.score < 65 ? Colors.warning : Colors.success;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.barCol}
                        onPress={() => handleRowPress(item.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.barNum, { color }]}>{item.score}</Text>
                        <View style={styles.barTrack}>
                          <LinearGradient
                            colors={[color, color + '66']}
                            style={[styles.barFill, { height: `${barH}%` }]}
                          />
                        </View>
                        <Text style={styles.barDate}>{fmtDate(item.created_at)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </GlassCard>
            )}

            {/* List */}
            <Text style={styles.sectionLabel}>All Analyses</Text>
            <View style={styles.historyGroup}>
              {history.map((h, i) => {
                const color = h.score < 40 ? Colors.danger : h.score < 65 ? Colors.warning : Colors.success;
                let deltaText = '';
                let deltaColor = Colors.textMuted;
                if (i < history.length - 1) {
                  const prev = history[i + 1].score;
                  const diff = h.score - prev;
                  if (diff > 0) {
                    deltaText = `+${diff}`;
                    deltaColor = Colors.success;
                  } else if (diff < 0) {
                    deltaText = `${diff}`;
                    deltaColor = Colors.danger;
                  }
                }
                const isLoading = rowLoading === h.id;

                return (
                  <React.Fragment key={h.id}>
                    {i > 0 && <View style={styles.rowSep} />}
                    <TouchableOpacity
                      onPress={() => handleRowPress(h.id)}
                      activeOpacity={0.7}
                      style={[styles.historyRow, isLoading && { opacity: 0.6 }]}
                      disabled={!!rowLoading}
                    >
                      <View style={[styles.scoreCircle, { borderColor: color }]}>
                        <Text style={[styles.scoreCircleNum, { color }]}>{h.score}</Text>
                      </View>
                      <View style={styles.historyInfo}>
                        <View style={styles.historyMeta}>
                          <Text style={styles.historyDate}>{fmtDate(h.created_at)}</Text>
                          {h.emotional_status?.emoji && (
                            <Text style={styles.historyEmoji}>{h.emotional_status.emoji}</Text>
                          )}
                          {deltaText ? (
                            <Text style={[styles.historyDelta, { color: deltaColor }]}>
                              {deltaText}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.historySummary} numberOfLines={2}>
                          {h.summary}
                        </Text>
                        {(h.has_action_plan || h.has_captions) && (
                          <View style={styles.historyBadges}>
                            {h.has_action_plan && <Text style={styles.historyBadge}>📋 Plan</Text>}
                            {h.has_captions && <Text style={styles.historyBadge}>📸 Captions</Text>}
                          </View>
                        )}
                      </View>
                      <Text style={styles.chevron}>{isLoading ? '⏳' : '›'}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Check-ins list */}
            {checkIns.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Monthly Check-Ins</Text>
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
  versionNote: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, marginBottom: Spacing.lg, fontStyle: 'italic' },
  chartCard: { padding: Spacing.lg, marginBottom: Spacing.xxl },
  chartTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, marginBottom: Spacing.lg, fontWeight: '600' },
  chart: { flexDirection: 'row', height: 120, gap: Spacing.sm, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.callout.fontSize, fontWeight: '700', marginBottom: Spacing.xs },
  barTrack: {
    flex: 1, width: '70%',
    backgroundColor: Colors.backgroundSecondary, borderRadius: 6,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 6 },
  barDate: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, marginTop: Spacing.xs },
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
  scoreCircle: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  scoreCircleNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.callout.fontSize, fontWeight: '700' },
  historyInfo: { flex: 1, gap: Spacing.xs },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  historyDate: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  historyDelta: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, fontWeight: '600' },
  historySummary: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18, marginTop: Spacing.xs / 2 },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.textMuted, fontWeight: '300' },
  checkinEmoji: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  checkinEmojiText: { fontSize: Typography.title2.fontSize },
  historyEmoji: { fontSize: Typography.subhead.fontSize, marginLeft: 2 },
  historyBadges: { flexDirection: 'row', gap: 6, marginTop: 3 },
  historyBadge: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted },
});
