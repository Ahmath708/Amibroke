import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import Svg, {
  Circle, Defs, LinearGradient as SvgGradient, Stop, RadialGradient, Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, withSpring, withSequence,
  runOnJS, useReducedMotion, type SharedValue,
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
  /**
   * Focal glow behind the ring + a quick arc draw, but NO count-up/haptic — for
   * a calm hero (e.g. the Dashboard score) that shouldn't buzz on every visit.
   */
  glow?: boolean;
}

function landHaptic() {
  impact(ImpactFeedbackStyle.Heavy);
}

// Rising-shimmer particles for a GOOD reveal: dots spread out + rise + fade.
// (A celebratory burst is reserved for good news — bad scores get a recoil shudder.)
const BURST_N = 12;
function BurstDot({ burst, index, color, size }: {
  burst: SharedValue<number>; index: number; color: string; size: number;
}) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const p = burst.value;
    const ang = (index / BURST_N) * Math.PI * 2;
    const dist = size * 0.5 * p;
    const tx = Math.cos(ang) * dist * 0.55;
    const ty = Math.sin(ang) * dist * 0.35 - size * 0.55 * p; // bias upward (rising)
    const opacity = p <= 0 ? 0 : (p < 0.18 ? p / 0.18 : 1 - (p - 0.18) / 0.82);
    const scale = 0.5 + p * 0.8;
    return { opacity, transform: [{ translateX: tx }, { translateY: ty }, { scale }] };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export default function ScoreRing({ score, size = 120, showLabel = false, showOutOf = false, reveal = false, glow = false }: Props) {
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
  const bloom = useSharedValue(0); // landing glow pulse (every score)
  const burst = useSharedValue(0); // rising-shimmer particles (good scores only)
  const shudder = useSharedValue(0); // recoil shake (Financially Fragile)
  // Tier follows the actual score BANDS (not arbitrary cutoffs): Stable/Thriving
  // celebrate (rising shimmer), Financially Fragile gets the ember, Surviving is
  // neutral (bloom only — the "meh" middle shouldn't over-praise or get torched).
  const tier: 'good' | 'mid' | 'broke' =
    band.label === 'Financially Fragile' ? 'broke'
      : band.label === 'Surviving' ? 'mid'
        : 'good'; // Stable | Thriving

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
        // Land it: overshoot-and-settle + glow bloom + haptic. Then a band-reactive
        // beat: good = rising shimmer (celebrate); Fragile = a recoil shudder (alarm,
        // never a celebratory burst); Surviving = nothing extra (calm).
        ringScale.value = withSequence(withSpring(1.04, Springs.bouncy), withSpring(1, Springs.gentle));
        bloom.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 700 }));
        if (tier === 'good') burst.value = withTiming(1, { duration: 1000 });
        if (tier === 'broke') {
          shudder.value = withSequence(
            withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
            withTiming(-6, { duration: 55 }), withTiming(6, { duration: 55 }),
            withTiming(-3, { duration: 50 }), withTiming(0, { duration: 50 }),
          );
        }
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

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shudder.value }, { scale: ringScale.value }],
  }));
  // Glow blooms (scales + brightens) on landing, then settles back to the calm anchored glow.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.9 + bloom.value * 0.1,
    transform: [{ scale: 1 + bloom.value * 0.28 }],
  }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, ringStyle]}>
      {/* Single anchored glow — the one allowed glow, in the score's own band color */}
      {(reveal || glow) && (
        <Animated.View style={[styles.glowLayer, glowStyle]} pointerEvents="none">
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
        </Animated.View>
      )}

      {/* Rising-shimmer particles — GOOD scores only (a burst on a bad score reads
          as celebration; Fragile gets the recoil shudder instead). */}
      {reveal && tier === 'good' && (
        <View style={styles.glowLayer} pointerEvents="none">
          {Array.from({ length: BURST_N }).map((_, i) => (
            <BurstDot key={i} burst={burst} index={i} color={color} size={size} />
          ))}
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
  dot: { position: 'absolute', left: '50%', top: '50%', width: 7, height: 7, borderRadius: 4, marginLeft: -3.5, marginTop: -3.5 },
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
