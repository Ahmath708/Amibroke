import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme/colors';

interface Props {
  emoji?: string;
  title: string;
  body: string;
  style?: any;
}

export default function EmptyState({ emoji = '📊', title, body, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.xl },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontFamily: Typography.fonts.heading, fontSize: 20, color: Colors.textPrimary, fontWeight: '700', marginBottom: 8 },
  body: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
