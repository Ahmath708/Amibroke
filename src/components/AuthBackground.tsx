import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';

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
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [p, delay, duration]);

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
 * Living auth background: a deep gradient with three slowly drifting neon orbs.
 * Self-contained (Reanimated, UI-thread) so only the auth screen gets the motion —
 * it doesn't touch the shared ScreenBackground used everywhere else.
 */
export default function AuthBackground() {
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#130b16', '#1a0026']} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <Orb colors={['#bd00ff', '#7c00cc']} size={340} top={-110} left={-70} range={70} duration={9000} delay={0} opacity={0.22} />
      <Orb colors={['#e7006e', '#bd00ff']} size={300} bottom={-90} right={-50} range={90} duration={11000} delay={1500} opacity={0.18} />
      <Orb colors={['#00e0ff', '#7c00cc']} size={220} top={240} right={-90} range={60} duration={13000} delay={800} opacity={0.12} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', borderRadius: 9999, overflow: 'hidden' },
});
