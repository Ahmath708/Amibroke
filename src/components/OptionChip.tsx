// Claude-Design single-select chip (rounded-rect, white label, accentSolid when selected). Used by the
// onboarding Setup step + the Life Context screen. Ref: .chip / .chip.sel in the Onboarding HTML.
// (Distinct from the legacy pill `SelectableChip`, which other screens still use pending migration.)
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion';
import { Colors, Typography } from '@/theme/colors';

export default function OptionChip({ label, active, onPress, icon: Icon }: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.chip, active && styles.chipSel]}>
      {Icon ? <Icon size={18} color={active ? Colors.accentSolid : Colors.textPrimary} /> : null}
      <Text style={[styles.text, active && styles.textSel]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { height: 50, paddingHorizontal: 20, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.glassBorder },
  chipSel: { backgroundColor: 'rgba(255,0,122,0.12)', borderColor: Colors.accentSolid },
  text: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, letterSpacing: -0.2, color: Colors.textPrimary },
  textSel: { color: Colors.accentSolid },
});
