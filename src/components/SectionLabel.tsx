import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme/colors';

/**
 * The all-caps section header used across the list screens (History's SCORE TREND /
 * ANALYSES / PROGRESS / MONTHLY CHECK-INS, etc.). One definition so they can't drift.
 * Pass `style` to tweak spacing per use (e.g. an extra marginTop before a new group).
 */
export default function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
});
