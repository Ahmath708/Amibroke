import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeonButton from '@/components/NeonButton';
import { Colors, Typography, Spacing } from '@/theme/colors';

/**
 * Sticky bottom CTA for paywall PREVIEW mode — the user is peeking at a real (read-only) screen.
 * Fades the content under it and routes back to the paywall to subscribe. `pointerEvents="box-none"`
 * so the transparent zone still scrolls; only the button captures taps.
 */
export default function PreviewUnlockBar({ caption, onUnlock }: { caption: string; onUnlock: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['transparent', Colors.background, Colors.background]}
      style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.md }]}
      pointerEvents="box-none"
    >
      <Text style={styles.caption}>{caption}</Text>
      <NeonButton label="Unlock to use" onPress={onUnlock} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.sm },
  caption: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center' },
});
