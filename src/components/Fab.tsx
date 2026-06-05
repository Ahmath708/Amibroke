import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from 'react-native-heroicons/outline';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';

type IconCmp = React.ComponentType<{ size?: number; color?: string }>;

interface Props {
  label: string;
  onPress: () => void;
  Icon?: IconCmp;                 // defaults to a "+" (create)
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Floating primary-create CTA — an accent gradient pill pinned bottom-right above the tab bar.
 * Shared by the Community feed ("Share") and the Home dashboard ("New Roast") so the two content
 * tabs stay structurally parallel (scroll content + one floating create action). Render it as a
 * sibling of the screen's ScrollView, inside the flex:1 root container.
 */
export default function Fab({ label, onPress, Icon = PlusIcon, accessibilityLabel, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md }, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient colors={Colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabInner}>
        <Icon size={20} color={Colors.onAccent} />
        <Text style={styles.fabText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: Spacing.xl },
  fabInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingLeft: Spacing.md, paddingRight: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    shadowColor: Colors.accentSolid, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  fabText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.onAccent, fontWeight: '600' },
});
