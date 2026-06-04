import React, { useEffect } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, interpolateColor, useReducedMotion,
} from 'react-native-reanimated';
import { Colors, Typography } from '@/theme/colors';
import { Durations, Easings } from '@/theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// MOMENTUM bands (deliberately NOT the score's health bands): soft accent → hot
// accent → green at the finish. Duplicated stops give a sharp flip at 33%/67%
// (no muddy magenta→green interpolation) that animates as the arc crosses them.
const BAND_STOPS = [0, 33, 33.001, 67, 67.001, 100];
const BAND_COLORS = [Colors.accent, Colors.accent, Colors.accentSolid, Colors.accentSolid, Colors.success, Colors.success];

interface Props {
  /** 0–100 completion. */
  pct: number;
  size?: number;
  stroke?: number;
}

/**
 * Plan-completion ring: a single accent-family arc that animates its fill and
 * shifts color across momentum thresholds as steps are completed. The % is the
 * centerpiece (no score — that lives in its own ring elsewhere). Honors Reduce Motion.
 */
export default function AnimatedProgressRing({ pct, size = 92, stroke = 9 }: Props) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reduce ? clamped : withTiming(clamped, { duration: Durations.normal, easing: Easings.smooth });
  }, [clamped, reduce]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value / 100),
    stroke: interpolateColor(progress.value, BAND_STOPS, BAND_COLORS),
  }));
  const numProps = useAnimatedProps(() => {
    const n = `${Math.round(progress.value)}%`;
    return { text: n, defaultValue: n } as object;
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={Colors.backgroundSecondary} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeDasharray={circ} animatedProps={arcProps} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <AnimatedTextInput
            editable={false} pointerEvents="none" underlineColorAndroid="transparent"
            value={`${clamped}%`} accessibilityLabel={`${clamped}% complete`}
            animatedProps={numProps} style={styles.pct}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pct: {
    fontFamily: Typography.fonts.heading, fontWeight: '700', fontSize: 22, color: Colors.textPrimary,
    padding: 0, textAlign: 'center', minWidth: 64, fontVariant: ['tabular-nums'],
  },
});
