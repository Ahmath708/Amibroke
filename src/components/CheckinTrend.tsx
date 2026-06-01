import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { goalProgress, formatGoalValue } from '@/utils/checkinGoals';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAR_MAX_H = 96;

/** Per-goal progress trend across check-ins (baseline → each check-in value). */
export default function CheckinTrend() {
  const { loading, configured, config, checkIns } = useCheckinStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading || !configured) return null;
  const goals = config.goals;
  const goal = goals.find((g) => g.id === selectedId) ?? goals[0];
  if (!goal) return null;

  // Chronological: baseline first, then each check-in that recorded this goal.
  const asc = [...checkIns].reverse();
  const points: { label: string; value: number }[] = [
    { label: 'Start', value: goal.baseline },
    ...asc
      .filter((c) => c.metrics && c.metrics[goal.id] != null)
      .map((c) => {
        const d = new Date(c.created_at);
        return { label: MONTHS_SHORT[d.getMonth()], value: c.metrics![goal.id] };
      }),
  ];
  if (points.length < 2) return null; // need at least one check-in to show movement

  const maxV = Math.max(...points.map((p) => Math.abs(p.value)), 1);

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.title}>Progress</Text>

      {goals.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {goals.map((g) => {
            const on = g.id === goal.id;
            return (
              <TouchableOpacity key={g.id} onPress={() => setSelectedId(g.id)} style={[styles.chip, on && styles.chipOn]} activeOpacity={0.7}>
                <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{g.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
        {points.map((p, i) => {
          const h = Math.max(6, (Math.abs(p.value) / maxV) * BAR_MAX_H);
          const prog = goalProgress(goal, p.value);
          const color = i === 0 || prog.delta === 0 ? Colors.textMuted : prog.improved ? Colors.success : Colors.danger;
          return (
            <View key={i} style={styles.col}>
              <Text style={[styles.val, { color }]} numberOfLines={1}>{formatGoalValue(goal.unit, p.value)}</Text>
              <View style={styles.barArea}>
                <LinearGradient colors={[color, color + '55']} style={[styles.bar, { height: h }]} />
              </View>
              <Text style={styles.colLabel} numberOfLines={1}>{p.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.xl },
  title: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '600', marginBottom: Spacing.md },
  chips: { gap: Spacing.xs, paddingBottom: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder },
  chipOn: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  chipText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, maxWidth: 120 },
  chipTextOn: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  chart: { alignItems: 'flex-end', gap: Spacing.lg, paddingTop: 14, paddingHorizontal: Spacing.xs, minWidth: '100%' },
  col: { alignItems: 'center', minWidth: 44 },
  val: { fontFamily: Typography.fonts.bodySemi, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  barArea: { height: BAR_MAX_H, justifyContent: 'flex-end' },
  bar: { width: 24, borderRadius: 6 },
  colLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, marginTop: 6 },
});
