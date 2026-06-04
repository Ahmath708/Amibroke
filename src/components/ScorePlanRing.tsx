import React, { useId } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, Typography } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';

interface Props {
  /** Current financial health score (0–100) — the app's North Star. */
  score: number;
  /** Plan completion 0–100. */
  pct: number;
  size?: number;
}

/**
 * Coach hero: a composite ring tying the plan to the score the whole app orbits.
 * INNER ring = the score (band gradient, same language as MiniScoreRing/ScoreRing);
 * OUTER thin arc = plan completion in the brand accent.
 */
export default function ScorePlanRing({ score, pct, size = 104 }: Props) {
  const gid = `spr-${useId().replace(/:/g, '')}`;
  const band = getScoreBand(score);
  const [from, to] = scoreGradient(score);
  const outerStroke = 4;
  const gap = 6;
  const innerStroke = 9;
  const outerR = (size - outerStroke) / 2;
  const innerR = outerR - outerStroke / 2 - gap - innerStroke / 2;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;
  const planPct = Math.max(0, Math.min(100, pct));
  const center = size / 2;
  const rot = `rotate(-90 ${center} ${center})`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </SvgGradient>
        </Defs>
        {/* inner: score */}
        <Circle cx={center} cy={center} r={innerR} fill="none" stroke={Colors.backgroundSecondary} strokeWidth={innerStroke} />
        <Circle cx={center} cy={center} r={innerR} fill="none" stroke={`url(#${gid})`} strokeWidth={innerStroke}
          strokeDasharray={innerC} strokeDashoffset={innerC * (1 - score / 100)} strokeLinecap="round" transform={rot} />
        {/* outer: plan completion */}
        <Circle cx={center} cy={center} r={outerR} fill="none" stroke={Colors.backgroundSecondary} strokeWidth={outerStroke} />
        <Circle cx={center} cy={center} r={outerR} fill="none" stroke={Colors.accentSolid} strokeWidth={outerStroke}
          strokeDasharray={outerC} strokeDashoffset={outerC * (1 - planPct / 100)} strokeLinecap="round" transform={rot} />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text style={[styles.score, { color: band.color }]}>{score}</Text>
          <Text style={styles.label}>SCORE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  score: { fontFamily: Typography.fonts.heading, fontWeight: '700', fontSize: 30, lineHeight: 34 },
  label: { fontFamily: Typography.fonts.bodySemi, fontSize: 9, letterSpacing: 1.2, color: Colors.textMuted },
});
