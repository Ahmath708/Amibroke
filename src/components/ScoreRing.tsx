import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import Svg, {
  Circle, Defs, LinearGradient as SvgGradient, Stop, RadialGradient, Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, withSpring, withSequence,
  runOnJS, useReducedMotion,
} from 'react-native-reanimated';
import { Colors, Typography } from '@/theme/colors';
import { Durations, Easings, Springs } from '@/theme/motion';
import { impact, ImpactFeedbackStyle } from '@/utils/haptics';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface Props {
  score: number;
  size?: number;
  showLabel?: boolean;
  showOutOf?: boolean;
  /**
   * Full "magic moment" reveal: the number counts up in lockstep with the arc
   * (~1.5s ease-out), a glow anchors behind the ring, and it lands with a haptic
   * + spring overshoot. Opt-in so the small rings (lists/history) stay calm.
   */
  reveal?: boolean;
}

function landHaptic() {
  impact(ImpactFeedbackStyle.Heavy);
}

export default function ScoreRing({ score, size = 120, showLabel = false, showOutOf = false, reveal = false }: Props) {
  const reduceMotion = useReducedMotion();
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Single source of truth — same band color/label the rest of the app uses.
  const band = getScoreBand(score);
  const color = band.color;
  const [gradFrom, gradTo] = scoreGradient(score);

  // ONE shared value drives both the arc and the number → guaranteed lockstep.
  const progress = useSharedValue(0);
  const ringScale = useSharedValue(1);

  useEffect(() => {
    const duration = reveal ? Durations.reveal : Durations.normal;
    if (reduceMotion) {
      progress.value = score; // snap — preserve the information, drop the travel
      if (reveal) landHaptic();
      return;
    }
    progress.value = withTiming(score, { duration, easing: Easings.smooth }, (finished) => {
      'worklet';
      if (finished && reveal) {
        // Land it: a tiny overshoot-and-settle + a haptic on the final frame.
        ringScale.value = withSequence(withSpring(1.04, Springs.bouncy), withSpring(1, Springs.gentle));
        runOnJS(landHaptic)();
      }
    });
  }, [score, reveal, reduceMotion]);

  const arcProps = useAnimatedProps(() => {
    'worklet';
    return { strokeDashoffset: circumference * (1 - progress.value / 100) };
  });

  const numberProps = useAnimatedProps(() => {
    'worklet';
    const n = `${Math.round(progress.value)}`;
    return { text: n, defaultValue: n } as object;
  });

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }] }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, ringStyle]}>
      {/* Single anchored glow — the one allowed glow, in the score's own band color */}
      {reveal && (
        <View style={styles.glowLayer} pointerEvents="none">
          <Svg width={size * 1.7} height={size * 1.7}>
            <Defs>
              <RadialGradient id="scoreGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <Stop offset="55%" stopColor={color} stopOpacity={0.12} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={size * 1.7} height={size * 1.7} fill="url(#scoreGlow)" />
          </Svg>
        </View>
      )}

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
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="url(#scoreRingGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={arcProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center content */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          {reveal ? (
            <AnimatedTextInput
              editable={false}
              underlineColorAndroid="transparent"
              value={`${score}`}
              accessibilityLabel={`${score}`}
              animatedProps={numberProps}
              style={[styles.scoreNum, styles.scoreNumInput, { fontSize: size * 0.26, color, width: size }]}
            />
          ) : (
            <Text style={[styles.scoreNum, { fontSize: size * 0.26, color }]}>{score}</Text>
          )}
          {showOutOf && <Text style={[styles.outOf, { fontSize: size * 0.1 }]}>/100</Text>}
          {showLabel && <Text style={styles.scoreLabel}>{band.label}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  glowLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreNum: {
    fontFamily: Typography.fonts.heading,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  scoreNumInput: { textAlign: 'center', padding: 0 },
  outOf: {
    fontFamily: Typography.fonts.body,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  scoreLabel: {
    fontFamily: Typography.fonts.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
