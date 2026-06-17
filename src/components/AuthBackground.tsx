import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { Colors } from '@/theme/colors';
import { resolveAccent } from '@/theme/palettes/accents';

const A = resolveAccent();

// Soft neon bloom — a feathered radial ellipse (matches the Claude Design auth screen's
// `radial-gradient(closest-side, rgba(255,0,122,0.16), transparent 75%)`, not a hard disc).
const BLOOM_W = 360;
const BLOOM_H = 230;

/**
 * Auth background: a flat dark field with ONE restrained, slowly-drifting neon bloom anchored LOW —
 * behind the primary CTA (matches the Claude Design auth screen). The doctrine bans *multiple*
 * drifting orbs as vibe-coded; a single subtle brand bloom on this first-impression surface is the
 * agreed-on exception. SVG radial gradient so the glow is feathered (RN has no CSS radial). Drift is
 * gentle and self-contained; reduce-motion pins it static.
 */
export default function AuthBackground() {
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const drift = useSharedValue(0.5);

  useEffect(() => {
    if (reduce) { drift.value = 0.5; return; }
    drift.value = withRepeat(withTiming(1, { duration: 13000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [drift, reduce]);

  const bloomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (drift.value - 0.5) * 28 },
      { translateY: (drift.value - 0.5) * 16 },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[Colors.groupedBackground, Colors.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <Animated.View style={[styles.bloom, { left: (width - BLOOM_W) / 2 }, bloomStyle]}>
        <Svg width={BLOOM_W} height={BLOOM_H}>
          <Defs>
            <RadialGradient id="authBloom" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={A.solid} stopOpacity={0.16} />
              <Stop offset="0.5" stopColor={A.solid} stopOpacity={0.06} />
              <Stop offset="1" stopColor={A.solid} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={BLOOM_W / 2} cy={BLOOM_H / 2} rx={BLOOM_W / 2} ry={BLOOM_H / 2} fill="url(#authBloom)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bloom: { position: 'absolute', bottom: 120 }, // anchored a bit above the CTA
});
