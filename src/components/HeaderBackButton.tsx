import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';

/**
 * Custom header back button — a plain Pressable chevron (NOT the native back button), so a
 * long-press can't trigger iOS's native back-history context menu. Reusable across screens via
 * `headerLeft: () => <HeaderBackButton />`. Currently wired only on the financial screens
 * (Debts / Subscriptions / Spending); roll out elsewhere once approved.
 */
export default function HeaderBackButton({ color = 'rgba(255,255,255,0.8)' }: { color?: string }) {
  const navigation = useNavigation();
  if (!navigation.canGoBack()) return null;
  return (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={styles.btn}
    >
      {/* Chevron is absolutely centered in the circular button bounds (not inline/padded) so it sits
          dead-center both axes. */}
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
        <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Circular button bounds, transparent (no background); the chevron is absolutely centered within.
  btn: { width: 34, height: 34, borderRadius: 17 },
  chevron: { position: 'absolute', top: '50%', left: '50%', marginTop: -12, marginLeft: -12 },
});
