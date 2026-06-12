// Money-trend card for the Finances tab — a single-metric line chart (Debt / Savings / Spending)
// over time, fed by services/moneyTrend.ts (merged roast history + check-ins, last-of-day). One metric
// at a time on purpose: balances and flows don't share an axis, and one line stays legible on a phone.
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { MONEY_METRICS, trendDelta, type MoneyTrend, type MoneyMetric, type TrendPoint } from '@shared/moneyTrend';
import { formatCompactCurrency } from '@/utils/format';

const LABELS: Record<MoneyMetric, string> = { debt: 'Debt', savings: 'Savings', spending: 'Spending' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (date: string) => MONTHS[parseInt(date.slice(5, 7), 10) - 1] ?? '';

// Savings is the one metric where UP is the good direction; debt + spending are good when they fall.
const isImproving = (metric: MoneyMetric, change: number) => (metric === 'savings' ? change > 0 : change < 0);

const CHART_H = 110;
const PAD_Y = 12;

export default function MoneyTrendCard({ trend }: { trend: MoneyTrend }) {
  const [metric, setMetric] = useState<MoneyMetric>('debt');
  const [w, setW] = useState(0);

  const series = trend[metric];
  const enough = series.length >= 2;
  const delta = trendDelta(series);
  const latest = series.length ? series[series.length - 1].value : 0;

  const flat = !delta || delta.change === 0;
  const improving = delta ? isImproving(metric, delta.change) : false;
  const deltaColor = flat ? Colors.textSecondary : improving ? Colors.success : Colors.danger;
  const arrow = flat ? '→' : delta!.change < 0 ? '↓' : '↑';

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Money trend</Text>

      <View style={styles.toggle}>
        {MONEY_METRICS.map((m) => {
          const active = m === metric;
          return (
            <PressableScale
              key={m}
              haptic="light"
              onPress={() => setMetric(m)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{LABELS[m]}</Text>
            </PressableScale>
          );
        })}
      </View>

      {enough ? (
        <>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaVal}>{formatCompactCurrency(latest)}</Text>
            <Text style={[styles.deltaChange, { color: deltaColor }]}>
              {arrow} {formatCompactCurrency(Math.abs(delta!.change))}
            </Text>
            <Text style={styles.deltaSince}>since {monthOf(series[0].date)}</Text>
          </View>
          <View style={styles.chartWrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
            {w > 0 && <TrendChart points={series} width={w} height={CHART_H} />}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Roast a couple times to start your {LABELS[metric].toLowerCase()} trend.</Text>
        </View>
      )}
    </View>
  );
}

// Area-filled line with hollow dots + a solid "now" dot. Flat series render as a centered line.
function TrendChart({ points, width, height }: { points: TrendPoint[]; width: number; height: number }) {
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const n = points.length;
  const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => (max === min ? height / 2 : PAD_Y + (1 - (v - min) / (max - min)) * (height - 2 * PAD_Y));
  const pts = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[n - 1].x.toFixed(1)} ${height} L ${pts[0].x.toFixed(1)} ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="moneyFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={Colors.accent} stopOpacity={0.2} />
          <Stop offset="1" stopColor={Colors.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#moneyFill)" />
      <Path d={line} stroke={Colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === n - 1 ? 4 : 2.5}
          fill={i === n - 1 ? Colors.accent : Colors.surfaceElevated}
          stroke={Colors.accent}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardLabel: {
    fontFamily: Typography.fonts.bodySemi,
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.md,
  },
  // Combined-pill segmented control — matches the Score-Trend filter (track makes it read as a filter).
  toggle: { flexDirection: 'row', backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, padding: 3, marginBottom: Spacing.md },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Colors.accentContainer },
  segmentLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  segmentLabelActive: { fontFamily: Typography.fonts.bodySemi, color: Colors.accent },

  deltaRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.xs },
  deltaVal: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, color: Colors.textPrimary, letterSpacing: -0.5 },
  deltaChange: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize },
  deltaSince: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted },

  chartWrap: { width: '100%', height: CHART_H, marginTop: Spacing.xs },
  empty: { height: CHART_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  emptyText: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
