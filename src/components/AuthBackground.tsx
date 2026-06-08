import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { resolveAccent } from '@/theme/palettes/accents';

const A = resolveAccent();

interface OrbProps {
  colors: [string, string];
  size: number;
  top?: number; left?: number; right?: number; bottom?: number;
  range: number;      // px drift amplitude
  duration: number;   // ms per half-cycle
  delay: number;
  opacity: number;
}

/** A single slowly-drifting, gently-scaling gradient orb. */
function Orb({ colors, size, top, left, right, bottom, range, duration, delay, opacity }: OrbProps) {
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { p.value = 0.5; return; } // reduce-motion: a static, centered glow (no drift)
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [p, delay, duration, reduce]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (p.value - 0.5) * range },
      { translateY: (p.value - 0.5) * range * 0.7 },
      { scale: 0.95 + p.value * 0.18 },
    ],
    opacity,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.orb, { width: size, height: size, top, left, right, bottom }, animStyle]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} />
    </Animated.View>
  );
}

/**
 * Auth background: a flat dark field with ONE restrained, slow, anchored accent
 * glow. (Research 2026-06-03: multiple drifting orbs read as vibe-coded; a single
 * subtle brand-colored glow on a first-impression surface is the defensible
 * config.) Self-contained Reanimated so only auth gets the motion. The fuller
 * branded entrance is finalized in the Phase 3 login reskin.
 */
export default function AuthBackground() {
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[Colors.groupedBackground, Colors.background]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <Orb colors={[A.solid, A.gradient[1]]} size={360} top={-120} left={-80} range={40} duration={14000} delay={0} opacity={0.16} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', borderRadius: 9999, overflow: 'hidden' },
});
