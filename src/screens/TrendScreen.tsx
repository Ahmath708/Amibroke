// History — the merged "journey" screen: a banded score-trend graph + headline stats (moved here from
// Profile) + the full roast list. Replaces the old graph-only Trend screen AND the separate All Roasts
// screen (one progress home, no duplication). Reached from the Dashboard's Trend + Roasts tiles.
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp, PressableScale } from '@/components/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, AnalysisHistoryItem } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import Skeleton from '@/components/Skeleton';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import SectionLabel from '@/components/SectionLabel';
import ScoreTrendChart from '@/components/ScoreTrendChart';
import AnalysisRow from '@/components/AnalysisRow';
import ScreenBackground from '@/components/ScreenBackground';
import { getAnalysisHistory, getAnalysisById } from '@/services/analyses';
import { useAuth } from '@/context/AuthContext';

export default function TrendScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowLoading, setRowLoading] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setError(null);
    try {
      const data = await getAnalysisHistory(user.id);
      setItems(data || []);
    } catch {
      setError('Failed to load history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchHistory(); }, [fetchHistory]));

  const onRefresh = useCallback(() => { setRefreshing(true); fetchHistory(); }, [fetchHistory]);

  const handleRowPress = async (id: string) => {
    if (rowLoading) return;
    setRowLoading(id);
    try {
      const analysis = await getAnalysisById(id);
      if (analysis) navigation.navigate('Results', { analysis, userInput: '', analysisId: id });
    } catch {
      // ignore
    } finally {
      setRowLoading(null);
    }
  };

  const count = items.length;
  const best = count ? Math.max(...items.map((i) => i.score)) : 0;
  const avg = count ? Math.round(items.reduce((s, i) => s + i.score, 0) / count) : 0;
  const scoresChrono = [...items].reverse().map((i) => i.score); // oldest → newest for the line

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="history" />
        <View style={[styles.scroll, { paddingTop: insets.top + 16 }]}>
          <Skeleton width="100%" height={200} radius={16} style={{ marginBottom: Spacing.lg }} />
          <Skeleton width="100%" height={72} radius={16} style={{ marginBottom: Spacing.xxl }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={72} radius={12} style={{ marginBottom: Spacing.sm }} />)}
        </View>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="history" />
        <ErrorState message={error} onRetry={fetchHistory} style={{ paddingTop: insets.top + 80 }} />
      </View>
    );
  }

  const header = (
    <>
      {!user && (
        <PressableScale onPress={() => navigation.navigate('Login')}>
          <Text style={styles.signInLink}>Sign in to track your progress →</Text>
        </PressableScale>
      )}
      {count >= 2 && <ScoreTrendChart scores={scoresChrono} />}
      {count > 0 && (
        <View style={styles.statsCard}>
          {[{ label: 'Roasts', value: String(count) }, { label: 'Avg', value: String(avg) }, { label: 'Best', value: String(best) }].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>
      )}
      {count > 0 && <SectionLabel>History</SectionLabel>}
    </>
  );

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="history" />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          const older = items[index + 1]; // DESC → the next item is the previous analysis
          const delta = older ? item.score - older.score : undefined;
          return (
            <AnalysisRow
              item={item}
              delta={delta}
              loading={rowLoading === item.id}
              disabled={!!rowLoading}
              onPress={() => handleRowPress(item.id)}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={<EmptyState emoji="📋" title="No roasts yet" body="Run your first roast to start tracking your financial glow-up." />}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accentSolid]} />
        }
      />
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: Spacing.xl },
  signInLink: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.accent, marginBottom: Spacing.lg },
  statsCard: {
    flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    paddingVertical: Spacing.md, marginBottom: Spacing.xl,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, fontWeight: '700' },
  statLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginVertical: Spacing.xs },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
});
