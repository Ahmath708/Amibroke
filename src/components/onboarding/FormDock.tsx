// Shared Act 2 (Build) footer dock: a "Back" text button + a circular neon "next" FAB. Reused by the
// form steps (FormShell) and the money steps (MoneyStep) so the nav chrome stays identical. Ref:
// docs/redesign/claude-design/Am I Broke - Onboarding.html (.back-btn / .next-fab / .kp-action).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowLongRightIcon, ArrowLongLeftIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing } from '@/theme/colors';

export function NextFab({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} hitSlop={8} accessibilityLabel="Continue"
      style={[styles.fab, disabled && styles.fabDisabled]}>
      <ArrowLongRightIcon size={28} color={Colors.onAccent} strokeWidth={2.4} />
    </PressableScale>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} hitSlop={8} style={styles.back} accessibilityLabel="Back">
      <ArrowLongLeftIcon size={17} color={Colors.textSecondary} strokeWidth={2.2} />
      <Text style={styles.backText}>Back</Text>
    </PressableScale>
  );
}

export default function FormDock({ onBack, onNext, canNext }: { onBack: () => void; onNext: () => void; canNext: boolean }) {
  return (
    <View style={styles.row}>
      <BackButton onPress={onBack} />
      <NextFab onPress={onNext} disabled={!canNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fab: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accentSolid,
    shadowColor: Colors.accentSolid, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  fabDisabled: { opacity: 0.32, shadowOpacity: 0 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs },
  backText: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.textSecondary, letterSpacing: -0.2 },
});
