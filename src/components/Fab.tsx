import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '@/components/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlusGlyph from '@/components/PlusGlyph';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { TAB_ROW_HEIGHT, TAB_FLOAT_MARGIN } from '@/navigation/constants';

type IconCmp = React.ComponentType<{ size?: number; color?: string }>;

interface Props {
  label: string;
  onPress: () => void;
  Icon?: IconCmp;                 // defaults to a "+" (create)
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Floating primary-create CTA — an accent gradient pill that sits just above the floating navpill
 * (Claude Design `.comm-fab`: a substantial ~50pt pill, not a tiny chip). Render it as a sibling
 * of the screen's ScrollView, inside the flex:1 root container.
 */
export default function Fab({ label, onPress, Icon = PlusGlyph, accessibilityLabel, style }: Props) {
  const insets = useSafeAreaInsets();
  // Anchor ~12pt above the navpill's top edge (navOffset + bar height), matching the prototype's
  // low placement — instead of floating high above the whole tab-bar clearance.
  const bottom = Math.min(insets.bottom, 26) + TAB_FLOAT_MARGIN + TAB_ROW_HEIGHT + 12;
  return (
    <PressableScale
      style={[styles.fab, { bottom }, style]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient colors={Colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabInner}>
        <Icon size={22} color={Colors.onAccent} />
        <Text style={styles.fabText}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: Spacing.xl },
  fabInner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 15,
    borderRadius: Radius.pill,
    shadowColor: Colors.accentSolid, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  fabText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.onAccent, fontWeight: '700' },
});
