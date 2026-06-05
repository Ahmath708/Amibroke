import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

/**
 * Small "needs attention / out of date" indicator, shared across the stale-state surfaces
 * (the Dashboard score hero, the plan/tools entry). Always pair it with a refresh/update CTA —
 * the badge signals, the CTA acts.
 */
export default function StaleBadge({ label, style }: { label: string; style?: ViewStyle }) {
  return (
    <View style={[styles.badge, style]}>
      <View style={styles.dot} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.pill, backgroundColor: Colors.accentContainer,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  text: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.accent },
});
