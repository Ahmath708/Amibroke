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
import Skeleton from '@/components/Skeleton';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { getAnalysisHistory, getAnalysisById } from '@/services/analyses';
import { AnalysisHistoryItem } from '@/types';
import ScreenBackground from '@/components/ScreenBackground';
import HistoryChart from '@/components/HistoryChart';
import { Granularity, itemsInPeriod } from '@/utils/historyChart';
import { useAuth } from '@/context/AuthContext';

export default function TrendScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
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
      const data = await getAnalysisHistory(user.id);
      setHistory(data || []);
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
        navigation.navigate('Results', { analysis, userInput: '', analysisId: id });
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


  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="history" />
        <View style={[styles.scroll, { paddingTop: insets.top + 16 }]}>
          <Skeleton width={130} height={13} style={{ marginBottom: Spacing.lg }} />
          <Skeleton width="100%" height={160} radius={16} style={{ marginBottom: Spacing.xxl }} />
          <Skeleton width={100} height={13} style={{ marginBottom: Spacing.md }} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={64} radius={12} style={{ marginBottom: Spacing.sm }} />
          ))}
        </View>
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accentSolid]}
          />
        }
      >
        {!user && (
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.subtitle, styles.signInLink]}>Sign in to track your progress →</Text>
          </TouchableOpacity>
        )}

        {history.length === 0 ? (
          <EmptyState emoji="📋" title="No roasts yet" body="Run your first roast to start tracking your financial progress over time." />
        ) : (
          // Trend = just the score chart now. The roast list lives on its own screen (All Roasts)
          // from the Dashboard "Roasts" tile; check-ins have their own CheckinCard on the Dashboard.
          <HistoryChart
            items={history}
            granularity={granularity}
            anchor={anchor}
            now={now}
            onChange={(g, a) => { setGranularity(g); setAnchor(a); }}
            onOpenAnalysis={handleRowPress}
          />
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: Spacing.xl },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xxl },
  signInLink: { color: Colors.accent, fontFamily: Typography.fonts.bodyMed },
});
