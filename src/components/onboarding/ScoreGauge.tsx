// Act 3 score gauge — the comet ring that the whole onboarding builds toward. One `progress` (0..1)
// shared value drives the arc length, the comet position, and the center number in lockstep. The
// loading stage HUNTS it toward random targets; the reveal stage settles it on the real score and
// dissolves the comet. Ref: .load-gauge / .reveal-gauge in the Onboarding HTML.
import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Colors, Typography } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const C = 2 * Math.PI * 82; // ≈ 515

export default function ScoreGauge({
  progress, cometOpacity, color = Colors.accentSolid, size = 256, glowColor, glowOpacity = 0, pad,
}: {
  progress: SharedValue<number>;       // 0..1
  cometOpacity: SharedValue<number>;   // 1 while forming, → 0 on lock
  color?: string;
  size?: number;
  glowColor?: string;
  glowOpacity?: number;
  pad?: boolean;                        // pad the number to 2 digits (loading)
}) {
  const arcProps = useAnimatedProps(() => {
    'worklet';
    return { strokeDashoffset: C * (1 - Math.max(0, Math.min(1, progress.value))) };
  });
  const cometStyle = useAnimatedStyle(() => ({
    opacity: cometOpacity.value,
    transform: [{ rotate: `${Math.max(0, Math.min(1, progress.value)) * 360}deg` }],
  }));
  const numberProps = useAnimatedProps(() => {
    'worklet';
    const n = Math.round(Math.max(0, Math.min(1, progress.value)) * 100);
    const s = pad ? `${n}`.padStart(2, '0') : `${n}`;
    return { text: s, defaultValue: s } as object;
  });

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* soft band-colored radial glow behind the ring (reveal) */}
      {glowColor ? (
        <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="gaugeGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={glowColor} stopOpacity={glowOpacity} />
              <Stop offset="58%" stopColor={glowColor} stopOpacity={glowOpacity * 0.35} />
              <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={100} cy={100} r={98} fill="url(#gaugeGlow)" />
        </Svg>
      ) : null}

      {/* track + arc */}
      <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
        <Circle cx={100} cy={100} r={82} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
        <AnimatedCircle
          cx={100} cy={100} r={82} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={C} rotation={-90} origin="100, 100" animatedProps={arcProps}
        />
      </Svg>

      {/* comet head (rotates to the arc's leading edge, dissolves on lock) */}
      <Animated.View style={[StyleSheet.absoluteFill, cometStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Circle cx={100} cy={18} r={9} fill="#fff" opacity={0.2} />
          <Circle cx={100} cy={18} r={5.5} fill="#fff" />
        </Svg>
      </Animated.View>

      {/* center number */}
      <View style={styles.center} pointerEvents="none">
        <AnimatedTextInput
          editable={false}
          style={[styles.num, { fontSize: Math.round(size * 0.30) }]}
          animatedProps={numberProps}
        />
        <Text style={styles.den}>/100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  num: { fontFamily: Typography.fonts.extrabold, letterSpacing: -3, color: Colors.textPrimary, padding: 0, textAlign: 'center', fontVariant: ['tabular-nums'] },
  den: { marginTop: 6, fontFamily: Typography.fonts.monoSemi, fontSize: 14, color: Colors.textTertiary },
});
