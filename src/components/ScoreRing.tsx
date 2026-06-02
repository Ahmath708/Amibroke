import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, Typography } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';

interface Props {
  score: number;
  size?: number;
  showLabel?: boolean;
}

export default function ScoreRing({ score, size = 120, showLabel = false }: Props) {
  const animatedScore = useRef(new Animated.Value(0)).current;
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 100;
  const strokeDashoffset = circumference * (1 - progress);
  // Single source of truth — same band color/label the rest of the app uses.
  const band = getScoreBand(score);
  const color = band.color;
  const [gradFrom, gradTo] = scoreGradient(score);

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [score]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgGradient id="scoreRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradFrom} />
            <Stop offset="100%" stopColor={gradTo} />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={Colors.backgroundSecondary}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="url(#scoreRingGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center content */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text style={[styles.scoreNum, { fontSize: size * 0.22, color }]}>{score}</Text>
          {showLabel && <Text style={styles.scoreLabel}>{band.label}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreNum: {
    fontFamily: Typography.fonts.heading,
    fontWeight: '700',
    letterSpacing: -1,
  },
  scoreLabel: {
    fontFamily: Typography.fonts.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
