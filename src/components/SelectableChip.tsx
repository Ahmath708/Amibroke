import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>; // optional leading Heroicon (e.g. tone selector)
  size?: 'sm' | 'md';      // sm = caption1 text (compact); md = footnote (default)
  style?: ViewStyle;       // layout extras (maxWidth, etc.)
  maxLines?: number;
}

/** The single source of truth for a tappable single-select pill (tone selector,
 *  context options, goal selector, amount picker). Active = accent border +
 *  accentContainer fill, label → accent/medium. */
export default function SelectableChip({ label, active, onPress, icon: Icon, size = 'md', style, maxLines }: Props) {
  const accent = active ? Colors.accent : Colors.textSecondary;
  return (
    <PressableScale style={[styles.chip, active && styles.chipActive, style]} onPress={onPress} haptic="light">
      {Icon ? <Icon size={size === 'sm' ? 14 : 16} color={accent} /> : null}
      <Text style={[styles.text, size === 'sm' && styles.textSm, active && styles.textActive]} numberOfLines={maxLines}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentContainer },
  text: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  textSm: { fontSize: Typography.caption1.fontSize },
  textActive: { color: Colors.accent, fontFamily: Typography.fonts.bodyMed },
});
