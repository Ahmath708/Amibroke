// The "Broke Card" — onboarding Act 3 payoff artifact (Plan 2). A neon foil card that prints the
// user's name, starting score, and band title, with a chip + barcode motif and an animated
// holographic sheen. Privacy-safe by design (no income/debt figures). Built to double as the
// shareable artifact later. Disciplined-neon: dark surface, accent foil edge, band-coloured score.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, useReducedMotion, Easing, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BrokeCard({ name, score, bandLabel, bandColor, dateStr }: {
  name: string;
  score: number;
  bandLabel: string;
  bandColor: string;
  /** Pass a fixed date string (avoid Date.now in shared/test contexts). Defaults to a blank. */
  dateStr?: string;
}) {
  const reduce = useReducedMotion();
  const sheen = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) { sheen.value = 1; return; }
    sheen.value = withDelay(220, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [reduce]);

  const sheenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -160 + sheen.value * 360 }], opacity: 0.5 - Math.abs(sheen.value - 0.5) }));

  return (
    <Animated.View entering={reduce ? FadeIn.duration(160) : FadeIn.duration(420)} style={styles.glowWrap}>
      <LinearGradient colors={Colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.foil}>
        <View style={styles.inner}>
          {/* holographic sheen */}
          <Animated.View pointerEvents="none" style={[styles.sheen, sheenStyle]} />

          <View style={styles.topRow}>
            <Text style={styles.brand}>AM I BROKE?</Text>
            <Text style={styles.network}>◆ NEON</Text>
          </View>

          <View style={styles.scoreRow}>
            <Text style={[styles.score, { color: bandColor }]}>{score}</Text>
            <Text style={styles.outOf}>/100</Text>
          </View>
          <Text style={styles.certified}>CERTIFIED · {bandLabel.toUpperCase()}</Text>

          {/* barcode */}
          <View style={styles.barcode}>
            {BARS.map((w, i) => (
              <View key={i} style={[styles.bar, { width: w }]} />
            ))}
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.chip} />
            <Text style={styles.name} numberOfLines={1}>{(name || 'YOU').toUpperCase()}</Text>
            <Text style={styles.date}>{dateStr ?? ''}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

/** Build a stable Month-Year date string from explicit parts (no Date.now). */
export function monthYear(d: { month: number; year: number }): string {
  return `${MONTHS[d.month] ?? ''} ${d.year}`;
}

// A fixed, "barcode-like" set of bar widths.
const BARS = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1, 1, 2, 1, 4, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1];

const styles = StyleSheet.create({
  glowWrap: {
    borderRadius: Radius.xl + 2,
    shadowColor: Colors.accentSolid, shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 8 },
  },
  foil: { borderRadius: Radius.xl + 2, padding: 1.5 }, // gradient edge
  inner: {
    backgroundColor: Colors.groupedBackground,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  sheen: { position: 'absolute', top: 0, bottom: 0, width: 90, backgroundColor: '#ffffff', opacity: 0.0, transform: [{ skewX: '-18deg' }] },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: Typography.fonts.heading, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary, letterSpacing: 1.5 },
  network: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.accent, letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Spacing.lg },
  score: { fontFamily: Typography.fonts.heading, fontSize: 56, fontWeight: '700', letterSpacing: -2 },
  outOf: { fontFamily: Typography.fonts.body, fontSize: Typography.title3.fontSize, color: Colors.textSecondary, marginLeft: 4 },
  certified: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary, letterSpacing: 1, marginTop: 2 },
  barcode: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 22, marginTop: Spacing.lg, opacity: 0.7 },
  bar: { height: '100%', backgroundColor: Colors.textSecondary, borderRadius: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  chip: { width: 30, height: 22, borderRadius: 4, backgroundColor: Colors.accentContainer, borderWidth: 1, borderColor: Colors.accent },
  name: { flex: 1, fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, letterSpacing: 0.5 },
  date: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
});
