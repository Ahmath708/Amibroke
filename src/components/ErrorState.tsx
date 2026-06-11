import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: any;
}

export default function ErrorState({ message = 'Something went wrong.', onRetry, retryLabel = 'Retry', style }: Props) {
  return (
    <View style={[styles.center, style]}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry && (
        <PressableScale onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>{retryLabel}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 80 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontFamily: Typography.fonts.heading, fontSize: 20, color: Colors.textPrimary, fontWeight: '700', marginBottom: 8 },
  body: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.xl },
  retryBtn: { marginTop: 20, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: Colors.accentContainer, borderRadius: Radius.md },
  retryText: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.accent, fontWeight: '600' },
});
