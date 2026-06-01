import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import type { AnalysisHistoryItem } from '@/types';
import {
  Granularity, GRANULARITIES, ChartSlot, ChartBar,
  buildSlots, periodLabel, shiftAnchor, isLatestPeriod,
} from '@/utils/historyChart';

interface Props {
  items: AnalysisHistoryItem[];
  granularity: Granularity;
  anchor: Date;
  now: Date;
  onChange: (g: Granularity, anchor: Date) => void;
  onOpenAnalysis: (id: string) => void;
}

const BAR_MAX_H = 104;
const BAR_W = 14;
const BAR_GAP = 3;
const SLOT_GAP = 10;

const FILTER_LABELS: Record<Granularity, string> = { year: 'Year', month: 'Month', week: 'Week', day: 'Day' };
// Drill target when an aggregate (collapsed) slot is tapped.
const FINER: Partial<Record<Granularity, Granularity>> = { year: 'month', month: 'day', week: 'day' };

function barColor(score: number): string {
  if (score < 40) return Colors.danger;
  if (score < 65) return Colors.warning;
  return Colors.success;
}

export default function HistoryChart({ items, granularity, anchor, now, onChange, onOpenAnalysis }: Props) {
  const slots = buildSlots(granularity, anchor, items);
  const atLatest = isLatestPeriod(granularity, anchor, now);
  const hasData = slots.some((s) => s.bars.length > 0);

  const tapBar = (slot: ChartSlot, bar: ChartBar) => {
    if (bar.kind === 'entry' && bar.id) {
      onOpenAnalysis(bar.id);
    } else {
      const finer = FINER[granularity];
      if (finer) onChange(finer, slot.date);
    }
  };

  return (
    <GlassCard style={styles.card}>
      {/* Granularity filter */}
      <View style={styles.segment}>
        {GRANULARITIES.map((g) => {
          const active = g === granularity;
          return (
            <TouchableOpacity
              key={g}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => onChange(g, anchor)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{FILTER_LABELS[g]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Period navigator */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => onChange(granularity, shiftAnchor(granularity, anchor, -1))} hitSlop={hit} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navLabel}>{periodLabel(granularity, anchor)}</Text>
        <TouchableOpacity
          onPress={() => !atLatest && onChange(granularity, shiftAnchor(granularity, anchor, 1))}
          disabled={atLatest}
          hitSlop={hit}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, atLatest && styles.navArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Bars */}
      {!hasData ? (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>
            {granularity === 'day' ? 'No analyses on this day' : 'No analyses in this period'}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {slots.map((slot, i) => (
            <View key={i} style={[styles.slot, { marginLeft: i === 0 ? 0 : SLOT_GAP }]}>
              <View style={styles.barsRow}>
                {slot.bars.length === 0 ? (
                  <View style={styles.emptyTick} />
                ) : (
                  slot.bars.map((bar, j) => {
                    const h = Math.max(4, (bar.score / 100) * BAR_MAX_H);
                    const color = barColor(bar.score);
                    return (
                      <TouchableOpacity
                        key={j}
                        onPress={() => tapBar(slot, bar)}
                        activeOpacity={0.7}
                        style={[styles.barCol, { marginLeft: j === 0 ? 0 : BAR_GAP }]}
                      >
                        {bar.kind === 'aggregate' ? (
                          <Text style={styles.badge}>×{bar.count}</Text>
                        ) : (
                          <Text style={[styles.barScore, { color }]}>{bar.score}</Text>
                        )}
                        <LinearGradient colors={[color, color + '55']} style={[styles.bar, { height: h }]} />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
              <Text style={[styles.slotLabel, slot.bars.length === 0 && styles.slotLabelMuted]} numberOfLines={1}>
                {slot.label}
              </Text>
              {slot.sublabel ? (
                <Text style={[styles.slotSublabel, slot.bars.length === 0 && styles.slotLabelMuted]} numberOfLines={1}>
                  {slot.sublabel}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </GlassCard>
  );
}

const hit = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.xxl },
  segment: {
    flexDirection: 'row', backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md, padding: 3, marginBottom: Spacing.md,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: Radius.sm },
  segmentItemActive: { backgroundColor: Colors.primaryContainer },
  segmentText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primary, fontFamily: Typography.fonts.bodySemi },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  navBtn: { paddingHorizontal: Spacing.md },
  navArrow: { fontSize: 26, color: Colors.primary, fontWeight: '300', lineHeight: 28 },
  navArrowDisabled: { color: Colors.textMuted, opacity: 0.4 },
  navLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  emptyChart: { height: BAR_MAX_H + 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textMuted },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'flex-end', paddingTop: 16 },
  slot: { alignItems: 'center' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H + 14 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: BAR_W, borderRadius: 5 },
  barScore: { fontFamily: Typography.fonts.bodySemi, fontSize: 9, fontWeight: '700', marginBottom: 3 },
  badge: { fontFamily: Typography.fonts.bodySemi, fontSize: 8, fontWeight: '700', color: Colors.textSecondary, marginBottom: 3 },
  emptyTick: { width: BAR_W, height: 3, borderRadius: 2, backgroundColor: Colors.separator },
  slotLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: 10, color: Colors.textSecondary, marginTop: 6 },
  slotSublabel: { fontFamily: Typography.fonts.body, fontSize: 9, color: Colors.textMuted, marginTop: 1 },
  slotLabelMuted: { color: Colors.textMuted, opacity: 0.5 },
});
