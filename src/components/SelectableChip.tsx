import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: IoniconsName;     // optional leading icon (e.g. tone selector)
  size?: 'sm' | 'md';      // sm = caption1 text (compact); md = footnote (default)
  style?: ViewStyle;       // layout extras (maxWidth, etc.)
  maxLines?: number;
}

/** The single source of truth for a tappable single-select pill (tone selector,
 *  context options, goal selector, amount picker). Active = primary border +
 *  primaryContainer fill, label → primary/medium. */
export default function SelectableChip({ label, active, onPress, icon, size = 'md', style, maxLines }: Props) {
  const accent = active ? Colors.primary : Colors.textSecondary;
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive, style]} onPress={onPress} activeOpacity={0.7}>
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 16} color={accent} /> : null}
      <Text style={[styles.text, size === 'sm' && styles.textSm, active && styles.textActive]} numberOfLines={maxLines}>
        {label}
      </Text>
    </TouchableOpacity>
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
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  text: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  textSm: { fontSize: Typography.caption1.fontSize },
  textActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
});
