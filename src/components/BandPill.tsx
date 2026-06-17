import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography, Radius } from '@/theme/colors';

interface Props {
  /** Band label, e.g. "Stable". */
  label: string;
  /** The band color (from getScoreBand(score).color) — bg @ ~13%, border @ ~33%, glowing dot. */
  color: string;
  /** md = score-hero pill (Results); sm = list/feed pill (Community, History). Default md. */
  size?: 'sm' | 'md';
}

/**
 * The score-band pill — a glowing band-colored dot + label in the band color, on a band-tinted
 * wash. The single source of truth for the band chip across Results, Community, History, Share.
 * Band colors are fixed/semantic (see getScoreBand); everything else is derived from `color`.
 */
export default function BandPill({ label, color, size = 'md' }: Props) {
  const md = size === 'md';
  return (
    <View style={[styles.pill, md ? styles.pillMd : styles.pillSm, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={[md ? styles.dotMd : styles.dotSm, { backgroundColor: color, shadowColor: color }]} />
      <Text style={[md ? styles.textMd : styles.textSm, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start' },
  pillMd: { gap: 8, paddingVertical: 9, paddingHorizontal: 16 },
  pillSm: { gap: 5, paddingVertical: 3, paddingHorizontal: 9 },
  dotMd: { width: 9, height: 9, borderRadius: 5, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  dotSm: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 0.8, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  textMd: { fontFamily: Typography.fonts.extrabold, fontSize: 18, letterSpacing: -0.4 },
  textSm: { fontFamily: Typography.fonts.extrabold, fontSize: 11, letterSpacing: -0.2 },
});
