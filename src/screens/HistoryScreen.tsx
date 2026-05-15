import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import GlassCard from '../components/GlassCard';
import StatusPill from '../components/StatusPill';

const { width } = Dimensions.get('window');

const HISTORY = [
  { id: '1', date: 'May 10', score: 42, label: 'Financially Fragile', summary: 'High credit card debt relative to income. Eating out is destroying you.', delta: null },
  { id: '2', date: 'Apr 8',  score: 38, label: 'At Risk', summary: 'No emergency fund. 3 unused subscriptions found.', delta: -4 },
  { id: '3', date: 'Mar 5',  score: 55, label: 'Getting By', summary: 'Savings rate improved. Student loan still a drag.', delta: +17 },
  { id: '4', date: 'Feb 1',  score: 47, label: 'Struggling', summary: 'Holiday spending hit hard. Back to basics.', delta: -8 },
];

const BAR_DATA = HISTORY.slice().reverse();
const MAX_SCORE = 100;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title */}
        <Text style={styles.largeTitle}>History</Text>
        <Text style={styles.subtitle}>{HISTORY.length} analyses · last 4 months</Text>

        {/* Chart card */}
        <GlassCard style={styles.chartCard}>
          <Text style={styles.chartTitle}>Score Over Time</Text>
          <View style={styles.chart}>
            {BAR_DATA.map((item, i) => {
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
                  <Text style={styles.barDate}>{item.date}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassCard>

        {/* List */}
        <Text style={styles.sectionLabel}>All Analyses</Text>
        <View style={styles.historyGroup}>
          {HISTORY.map((item, i) => {
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
                      <Text style={styles.historyDate}>{item.date}</Text>
                      {item.delta != null && (
                        <Text style={[styles.historyDelta, { color: item.delta > 0 ? Colors.success : Colors.danger }]}>
                          {item.delta > 0 ? '+' : ''}{item.delta} pts
                        </Text>
                      )}
                    </View>
                    <StatusPill label={item.label} variant={variant} />
                    <Text style={styles.historySummary} numberOfLines={2}>{item.summary}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
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
  subtitle: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, marginBottom: 24 },
  chartCard: { padding: 16, marginBottom: 24 },
  chartTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, marginBottom: 16, fontWeight: '600' },
  chart: { flexDirection: 'row', height: 120, gap: 10, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barNum: { fontFamily: Typography.fonts.heading, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  barTrack: {
    flex: 1, width: '70%',
    backgroundColor: Colors.backgroundSecondary, borderRadius: 6,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 6 },
  barDate: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  historyGroup: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 70 },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  scoreCircle: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  scoreCircleNum: { fontFamily: Typography.fonts.heading, fontSize: 16, fontWeight: '700' },
  historyInfo: { flex: 1, gap: 5 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyDate: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textPrimary },
  historyDelta: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, fontWeight: '600' },
  historySummary: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
});
