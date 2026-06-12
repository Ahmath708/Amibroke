// Score-trend chart for the History screen — a banded-color line of the user's score over time. The
// line's color is sampled from getScoreBand across the visible range, so it shifts red→amber→teal→green
// as the score climbs (the band journey) without re-encoding the band cutoffs. Display-only (no tapping).
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';

const CHART_H = 130;
const PAD_Y = 14;
const STOPS = 18; // gradient samples top→bottom; getScoreBand's steps give the banded look

export default function ScoreTrendChart({ scores }: { scores: number[] }) {
  const [w, setW] = useState(0);
  if (scores.length < 2) return null;

  const first = scores[0];
  const last = scores[scores.length - 1];
  const lastBand = getScoreBand(last);

  const yMin = Math.max(0, Math.min(...scores) - 8);
  const yMax = Math.min(100, Math.max(...scores) + 8);
  const stops = Array.from({ length: STOPS }, (_, i) => {
    const t = i / (STOPS - 1);
    return { offset: t, color: getScoreBand(yMax - t * (yMax - yMin)).color };
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Score trend</Text>
        <Text style={styles.fromTo}>
          {first} <Text style={styles.arrow}>→</Text> <Text style={{ color: lastBand.color }}>{last}</Text>
        </Text>
      </View>
      <View style={styles.chartWrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && <BandedLine scores={scores} width={w} height={CHART_H} yMin={yMin} yMax={yMax} stops={stops} />}
      </View>
      <Text style={[styles.band, { color: lastBand.color }]}>{lastBand.label}</Text>
    </View>
  );
}

function BandedLine({ scores, width, height, yMin, yMax, stops }: {
  scores: number[]; width: number; height: number; yMin: number; yMax: number;
  stops: { offset: number; color: string }[];
}) {
  const n = scores.length;
  const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (s: number) => PAD_Y + (1 - (s - yMin) / (yMax - yMin)) * (height - 2 * PAD_Y);
  const pts = scores.map((s, i) => ({ x: x(i), y: y(s) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[n - 1].x.toFixed(1)} ${height} L ${pts[0].x.toFixed(1)} ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="scoreLine" x1="0" y1="0" x2="0" y2="1">
          {stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} />)}
        </LinearGradient>
        <LinearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
          {stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.13} />)}
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#scoreFill)" />
      <Path d={line} stroke="url(#scoreLine)" strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 4.5 : 2.5} fill={getScoreBand(scores[i]).color} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    padding: Spacing.lg, marginBottom: Spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  fromTo: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, fontWeight: '700' },
  arrow: { color: Colors.textMuted },
  chartWrap: { width: '100%', height: CHART_H, marginTop: Spacing.md },
  band: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, marginTop: Spacing.xs, textAlign: 'right' },
});
