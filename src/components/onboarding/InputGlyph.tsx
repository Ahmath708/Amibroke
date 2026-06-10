// Per-input neon glyph for onboarding Act 2 — a glowing accent halo around the icon that identifies
// each question (name, location, income, debt, savings…). Animated entrance + a soft idle pulse;
// static under reduced motion. Disciplined-neon: one accent, the icon is the vector, the halo + glow
// are the custom treatment.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, withDelay, useReducedMotion, Easing } from 'react-native-reanimated';
import {
  SparklesIcon, MapPinIcon, CalendarDaysIcon, HomeIcon, BriefcaseIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, ShieldCheckIcon,
} from 'react-native-heroicons/solid';
import { Colors } from '@/theme/colors';

export type GlyphKind = 'name' | 'location' | 'age' | 'housing' | 'employment' | 'income' | 'debt' | 'savings';

const ICONS: Record<GlyphKind, React.ComponentType<any>> = {
  name: SparklesIcon,
  location: MapPinIcon,
  age: CalendarDaysIcon,
  housing: HomeIcon,
  employment: BriefcaseIcon,
  income: ArrowTrendingUpIcon,
  debt: ArrowTrendingDownIcon,
  savings: ShieldCheckIcon,
};

const SIZE = 56;

export default function InputGlyph({ kind }: { kind: GlyphKind }) {
  const reduce = useReducedMotion();
  const Icon = ICONS[kind];

  const scale = useSharedValue(reduce ? 1 : 0.7);
  const glow = useSharedValue(reduce ? 1 : 0.5);

  useEffect(() => {
    if (reduce) { scale.value = 1; glow.value = 1; return; }
    scale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) });
    // gentle breathing glow
    glow.value = withDelay(320, withRepeat(withSequence(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.55, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
    ), -1, true));
  }, [kind, reduce]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <Animated.View style={[styles.circle, circleStyle]}>
        <Icon size={26} color={Colors.accent} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE + 24, height: SIZE + 24, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: SIZE + 18, height: SIZE + 18, borderRadius: (SIZE + 18) / 2,
    backgroundColor: Colors.accent, opacity: 0.6,
    shadowColor: Colors.accentSolid, shadowOpacity: 0.9, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  circle: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    backgroundColor: Colors.accentContainer,
    borderWidth: 1.5, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
