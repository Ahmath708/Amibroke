import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/theme/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'default' | 'inset' | 'plain';
  padding?: number;
}

export default function GlassCard({ children, style, variant = 'default', padding }: Props) {
  return (
    <View style={[
      styles.base,
      variant === 'inset' && styles.inset,
      variant === 'plain' && styles.plain,
      padding !== undefined && { padding },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Default = an *elevated* surface: on dark, depth comes from a lighter surface
  // + a crisp top-lit border, not shadow (Material/Linear dark-mode approach).
  base: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
    overflow: 'hidden',
  },
  inset: {
    backgroundColor: Colors.surface,
    borderColor: Colors.glassBorderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  plain: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
});
