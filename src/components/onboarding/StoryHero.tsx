// Act 1 (Story) hero visuals for onboarding-v2 (Plan 2). Composed neon visuals (no fragile
// hand-drawn paths): a balance-peel (green balance hiding red debt), a ghosted score dial, and a
// verdict "bloom". Entrance + idle motion; static under reduced motion. Disciplined-neon tokens.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, withDelay, useReducedMotion, Easing } from 'react-native-reanimated';
import { FireIcon } from 'react-native-heroicons/solid';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

export type StoryScene = 'peel' | 'dial' | 'bloom';

export default function StoryHero({ scene }: { scene: StoryScene }) {
  if (scene === 'peel') return <Peel />;
  if (scene === 'dial') return <Dial />;
  return <Bloom />;
}

// Green "balance" card lifting to reveal the red debt beneath.
function Peel() {
  const reduce = useReducedMotion();
  const lift = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { lift.value = 1; return; }
    lift.value = withDelay(250, withRepeat(withSequence(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.25, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
    ), -1, true));
  }, [reduce]);
  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 34 }, { rotate: `${-lift.value * 6}deg` }] }));

  return (
    <View style={styles.heroBox}>
      <View style={[styles.card, styles.debtCard]}>
        <Text style={styles.debtLabel}>HIDDEN DEBT</Text>
        <Text style={styles.debtVal}>−$18,500</Text>
      </View>
      <Animated.View style={[styles.card, styles.balanceCard, topStyle]}>
        <Text style={styles.balLabel}>BALANCE</Text>
        <Text style={styles.balVal}>$4,210</Text>
      </Animated.View>
    </View>
  );
}

// A ghosted 0–100 dial pulsing in the void.
function Dial() {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(reduce ? 1 : 0.6);
  useEffect(() => {
    if (reduce) { pulse.value = 1; return; }
    pulse.value = withRepeat(withSequence(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.55, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
    ), -1, true);
  }, [reduce]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.4, transform: [{ scale: 0.96 + pulse.value * 0.06 }] }));
  return (
    <View style={styles.heroBox}>
      <Animated.View style={[styles.dialGlow, ringStyle]} />
      <Animated.View style={[styles.dial, ringStyle]}>
        <Text style={styles.dialQ}>?</Text>
        <Text style={styles.dialOut}>/100</Text>
      </Animated.View>
    </View>
  );
}

// A blooming accent orb with the roast flame.
function Bloom() {
  const reduce = useReducedMotion();
  const b = useSharedValue(reduce ? 1 : 0.5);
  useEffect(() => {
    if (reduce) { b.value = 1; return; }
    b.value = withRepeat(withSequence(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
    ), -1, true);
  }, [reduce]);
  const bloomStyle = useAnimatedStyle(() => ({ opacity: 0.4 + b.value * 0.5, transform: [{ scale: 0.9 + b.value * 0.18 }] }));
  return (
    <View style={styles.heroBox}>
      <Animated.View style={[styles.bloomOrb, bloomStyle]} />
      <View style={styles.bloomCore}><FireIcon size={40} color={Colors.onAccent} /></View>
    </View>
  );
}

const HERO = 200;
const styles = StyleSheet.create({
  heroBox: { width: '100%', height: HERO, alignItems: 'center', justifyContent: 'center' },
  // Peel
  card: { position: 'absolute', width: 200, height: 110, borderRadius: Radius.lg, padding: Spacing.lg, justifyContent: 'center' },
  debtCard: { backgroundColor: 'rgba(255,77,109,0.16)', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.danger, transform: [{ translateY: 26 }] },
  debtLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.danger, letterSpacing: 1, alignSelf: 'flex-end' },
  debtVal: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.danger, alignSelf: 'flex-end' },
  balanceCard: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.success },
  balLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.success, letterSpacing: 1 },
  balVal: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, color: Colors.textPrimary },
  // Dial
  dialGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: Colors.accent, opacity: 0.25, shadowColor: Colors.accentSolid, shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  dial: { width: 150, height: 150, borderRadius: 75, borderWidth: 8, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  dialQ: { fontFamily: Typography.fonts.heading, fontSize: 52, color: Colors.textPrimary },
  dialOut: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  // Bloom
  bloomOrb: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: Colors.accent, shadowColor: Colors.accentSolid, shadowOpacity: 1, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
  bloomCore: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentSolid },
});
