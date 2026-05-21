import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import StatusPill from '@/components/StatusPill';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { getAnalysisHistory, getCheckIns } from '@/services/claudeApi';
import { AnalysisHistoryItem, CheckIn } from '@/types';
import { useAuth } from '@/context/AuthContext';

const MAX_SCORE = 100;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const barData = [...history].reverse();

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
        <LoadingState style={{ paddingTop: insets.top + 80 }} />
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
        <ErrorState message={error} onRetry={fetchHistory} style={{ paddingTop: insets.top + 80 }} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title */}
        <Text style={styles.largeTitle}>History</Text>
        {user ? (
          <Text style={styles.subtitle}>{history.length} analyses</Text>
        ) : (
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.subtitle, styles.signInLink]}>Sign in to track your progress →</Text>
          </TouchableOpacity>
        )}

        {history.length === 0 ? (
          <EmptyState emoji="📊" title="No analyses yet" body="Run your first analysis to start tracking your financial progress over time." />
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
                        onPress={() => setSelected(selected === item.id ? null : item.id)}
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
              {history.map((item: AnalysisHistoryItem, i: number) => {
                const variant = item.score < 40 ? 'danger' : item.score < 65 ? 'warning' : 'good';
                const scoreColor = item.score < 40 ? Colors.danger : item.score < 65 ? Colors.warning : Colors.success;
                return (
                  <React.Fragment key={item.id}>
                    {i > 0 && <View style={styles.rowSep} />}
                    <TouchableOpacity style={styles.historyRow} activeOpacity={0.7}>
                      <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
                        <Text style={[styles.scoreCircleNum, { color: scoreColor }]}>{item.score}</Text>
                      </View>
                      <View style={styles.historyInfo}>
                        <View style={styles.historyMeta}>
                          <Text style={styles.historyDate}>{fmtDate(item.created_at)}</Text>
                        </View>
                        <StatusPill label={item.score_label} variant={variant} />
                        <Text style={styles.historySummary} numberOfLines={2}>{item.summary}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Check-ins */}
            {checkIns.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.xxl }]}>Monthly Check-Ins</Text>
                <View style={styles.historyGroup}>
                  {checkIns.map((c, i) => {
                    const moodLabels = ['Stressed', 'Worried', 'Getting By', 'Feeling Good', 'On Fire'];
                    const moodEmojis = ['😭', '😟', '😐', '🙂', '🤑'];
                    return (
                      <React.Fragment key={c.id}>
                        {i > 0 && <View style={styles.rowSep} />}
                        <View style={styles.historyRow}>
                          <View style={styles.checkinEmoji}>
                            <Text style={styles.checkinEmojiText}>{moodEmojis[c.mood] || '😐'}</Text>
                          </View>
                          <View style={styles.historyInfo}>
                            <View style={styles.historyMeta}>
                              <Text style={styles.historyDate}>{fmtDate(c.created_at)}</Text>
                              <StatusPill label={moodLabels[c.mood] || 'Getting By'} variant="info" />
                            </View>
                            <Text style={styles.historySummary} numberOfLines={1}>
                              {c.notes || `${c.income ? `$${c.income}` : '—'} income · ${c.savings ? `$${c.savings}` : '—'} saved`}
                            </Text>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  emptyState: { alignItems: 'center', paddingTop: Spacing.section + Spacing.xxl, paddingHorizontal: Spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.lg },
  emptyTitle: { fontFamily: Typography.fonts.heading, ...Typography.title3, color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyBody: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  largeTitle: {
    fontFamily: Typography.fonts.heading,
    ...Typography.largeTitle,
    color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xxl },
  signInLink: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
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
  retryBtn: {
    marginTop: Spacing.xl, paddingHorizontal: Spacing.xxl + Spacing.xs, paddingVertical: Spacing.md,
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.md,
  },
  retryBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.primary, fontWeight: '600' },
  checkinEmoji: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  checkinEmojiText: { fontSize: Typography.title2.fontSize },
});
