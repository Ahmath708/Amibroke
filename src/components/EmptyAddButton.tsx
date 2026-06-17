import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { PlusIcon } from 'react-native-heroicons/solid';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Radius } from '@/theme/colors';

/**
 * The "+ Add your first X" CTA for manager empty states (debts / spending / subscriptions).
 * A dashed accent pill whose width HUGS its label (`alignSelf: center` + intrinsic width) with
 * comfortable padding — deliberately NOT full-width (the Claude-Design prototype over-extended it)
 * and not cramped.
 */
export default function EmptyAddButton({ label, onPress, style }: { label: string; onPress: () => void; style?: ViewStyle }) {
  return (
    <PressableScale style={[styles.btn, style]} onPress={onPress} haptic="light">
      <PlusIcon size={18} color={Colors.accentSolid} />
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 22, borderRadius: Radius.lg,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accentSolid,
    backgroundColor: Colors.accentContainer,
  },
  label: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.accentSolid, letterSpacing: -0.2 },
});
