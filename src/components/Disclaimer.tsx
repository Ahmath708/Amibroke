import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme/colors';

export default function Disclaimer({ style }: { style?: any }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>
        ⚠️ This app is for educational and entertainment purposes only and does not constitute financial advice. Always consult a qualified financial professional for personalized guidance.
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
