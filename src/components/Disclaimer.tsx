import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme/colors';

export default function Disclaimer({ style }: { style?: any }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>
        Personalized guidance based on what you share — not a substitute for a licensed professional on investments, taxes, or legal decisions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  text: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.caption2.fontSize,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
});
