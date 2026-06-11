import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
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

// Scaled up from the original (104/14/10) for readability.
const BAR_MAX_H = 140;
const BAR_W = 20;
const BAR_GAP = 4;
const SLOT_GAP = 13;
const LABEL_SPACE = 22; // vertical room above a full-height bar for its score

// Chart frame: 'anchored' = a frameless hero chart with a faint baseline under
// the bars (vs 'card' = elevated card, 'frameless' = no surface at all).
const FRAME: 'card' | 'frameless' | 'anchored' = 'anchored';

const FILTER_LABELS: Record<Granularity, string> = { year: 'Year', month: 'Month', week: 'Week', day: 'Day' };
// Drill target when an aggregate (collapsed) slot is tapped.
const FINER: Partial<Record<Granularity, Granularity>> = { year: 'month', month: 'day', week: 'day' };

// Single source of truth — same band color as the entry rings, Results, etc.
// The bar keeps its existing color→translucent gradient (see render), now band-tinted.
function barColor(score: number): string {
  return getScoreBand(score).color;
}

export default function HistoryChart({ items, granularity, anchor, now, onChange, onOpenAnalysis }: Props) {
  const slots = buildSlots(granularity, anchor, items);
  const atLatest = isLatestPeriod(granularity, anchor, now);
  const hasData = slots.some((s) => s.bars.length > 0);
  // Year shows all 12 months at once; tighten the gap so the 3-letter labels fit
  // the card width without clipping Dec (other granularities scroll, so keep 10).
  const slotGap = granularity === 'year' ? 6 : SLOT_GAP;

  const tapBar = (slot: ChartSlot, bar: ChartBar) => {
    if (bar.kind === 'entry' && bar.id) {
      onOpenAnalysis(bar.id);
    } else {
      const finer = FINER[granularity];
      if (finer) onChange(finer, slot.date);
    }
  };

  const content = (
    <>
      {/* Granularity filter */}
      <View style={styles.segment}>
        {GRANULARITIES.map((g) => {
          const active = g === granularity;
          return (
            <PressableScale
              key={g}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => onChange(g, anchor)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{FILTER_LABELS[g]}</Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Period navigator */}
      <View style={styles.nav}>
        <PressableScale onPress={() => onChange(granularity, shiftAnchor(granularity, anchor, -1))} hitSlop={hit} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </PressableScale>
        <Text style={styles.navLabel}>{periodLabel(granularity, anchor)}</Text>
        <PressableScale
          onPress={() => !atLatest && onChange(granularity, shiftAnchor(granularity, anchor, 1))}
          disabled={atLatest}
          hitSlop={hit}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, atLatest && styles.navArrowDisabled]}>›</Text>
        </PressableScale>
      </View>

      {/* Bars */}
      {!hasData ? (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>
            {granularity === 'day' ? 'No analyses on this day' : 'No analyses in this period'}
          </Text>
        </View>
      ) : (
        <View style={styles.chartWrap}>
          {FRAME === 'anchored' && <View style={styles.baseline} pointerEvents="none" />}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
          {slots.map((slot, i) => (
            <View key={i} style={[styles.slot, { marginLeft: i === 0 ? 0 : slotGap }]}>
              <View style={styles.barsRow}>
                {slot.bars.length === 0 ? (
                  <View style={styles.emptyTick} />
                ) : (
                  slot.bars.map((bar, j) => {
                    const h = Math.max(4, (bar.score / 100) * BAR_MAX_H);
                    const color = barColor(bar.score);
                    return (
                      <PressableScale
                        key={j}
                        onPress={() => tapBar(slot, bar)}
                        style={[styles.barCol, { marginLeft: j === 0 ? 0 : BAR_GAP }]}
                      >
                        <Text style={[styles.barScore, { color }]}>{bar.score}</Text>
                        <LinearGradient colors={[color, color + '55']} style={[styles.bar, { height: h }]} />
                      </PressableScale>
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
        </View>
      )}
    </>
  );

  if (FRAME === 'card') {
    return <GlassCard style={styles.card}>{content}</GlassCard>;
  }
  return <View style={styles.cardFrameless}>{content}</View>;
}

const hit = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.xxl },
  cardFrameless: { marginBottom: Spacing.xxl },
  chartWrap: { position: 'relative' },
  baseline: { position: 'absolute', left: 0, right: 0, top: 18 + BAR_MAX_H + LABEL_SPACE, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  segment: {
    flexDirection: 'row', backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md, padding: 3, marginBottom: Spacing.md,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: Radius.sm },
  segmentItemActive: { backgroundColor: Colors.accentContainer },
  segmentText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.accent, fontFamily: Typography.fonts.bodySemi },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  navBtn: { paddingHorizontal: Spacing.md },
  navArrow: { fontSize: 26, color: Colors.accent, fontWeight: '300', lineHeight: 28 },
  navArrowDisabled: { color: Colors.textMuted, opacity: 0.4 },
  navLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  emptyChart: { height: BAR_MAX_H + 48, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textMuted },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'flex-end', paddingTop: 18 },
  slot: { alignItems: 'center' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H + LABEL_SPACE },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: BAR_W, borderRadius: 6 },
  barScore: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  emptyTick: { width: BAR_W, height: 3, borderRadius: 2, backgroundColor: Colors.separator },
  slotLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  slotSublabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  slotLabelMuted: { color: Colors.textMuted, opacity: 0.5 },
});
