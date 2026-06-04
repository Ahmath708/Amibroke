import React, { useId } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, Typography } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';

interface Props {
  score: number;
  size: number;
  stroke: number;
  /** Centered number font size (px) — varies per surface. */
  numberSize: number;
}

/**
 * Small, STATIC band-gradient score ring with a centered score number — the
 * non-animated ring used in lists/cards (AnalysisRow, ShareManager, Profile,
 * Community). Consolidates 4 hand-rolled copies of the same SVG. The big
 * animated reveal/glow ring is the separate ScoreRing.
 */
export default function MiniScoreRing({ score, size, stroke, numberSize }: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = getScoreBand(score).color;
  const [from, to] = scoreGradient(score);
  // react-native-svg gradient ids are effectively global → must be unique per
  // instance (multiple rings render at once in lists). Strip useId's colons,
  // which aren't valid in a url(#…) fragment ref.
  const gid = `msr-${useId().replace(/:/g, '')}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={Colors.backgroundSecondary} strokeWidth={stroke} />
        <Circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text style={[styles.num, { fontSize: numberSize, color }]}>{score}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: Typography.fonts.heading, fontWeight: '700' },
});
