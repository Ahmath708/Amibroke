import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '@/theme/colors';

type Variant = 'good' | 'warning' | 'danger' | 'info' | 'premium' | 'muted';

interface Props {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
  /**
   * Explicit color override (text + a translucent matching bg). Pass
   * getScoreBand(score).color for canonical score colors — bypasses the lossy
   * 3-variant mapping so the pill matches the single source of truth.
   */
  color?: string;
}

const CONFIG: Record<Variant, { bg: string; color: string }> = {
  good:    { bg: Colors.successContainer, color: Colors.success },
  warning: { bg: Colors.warningContainer, color: Colors.warning },
  danger:  { bg: Colors.dangerContainer,  color: Colors.danger  },
  info:    { bg: Colors.infoContainer,    color: Colors.secondary },
  premium: { bg: Colors.primaryContainer, color: Colors.primary },
  muted:   { bg: 'rgba(255,255,255,0.07)', color: Colors.textSecondary },
};

export default function StatusPill({ label, variant = 'info', size = 'sm', color: colorOverride }: Props) {
  const base = CONFIG[variant];
  const color = colorOverride ?? base.color;
  const bg = colorOverride ? `${colorOverride}22` : base.bg; // ~13% alpha container from the band color
  return (
    <View style={[styles.pill, { backgroundColor: bg }, size === 'md' && styles.pillMd]}>
      <Text style={[styles.text, { color }, size === 'md' && styles.textMd]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillMd: { paddingHorizontal: 12, paddingVertical: 5 },
  text: {
    fontFamily: Typography.fonts.bodySemi,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textMd: { fontSize: 13 },
});
