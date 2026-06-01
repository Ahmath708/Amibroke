import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  onPress: () => void;
  style?: ViewStyle;
}

/** Reusable "Go Premium" upsell card (Home, Profile, …) for consistent design. */
export default function PremiumCard({ onPress, style }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={style}>
      <LinearGradient
        colors={['rgba(189,0,255,0.25)', 'rgba(231,0,110,0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.textWrap}>
          <Text style={styles.title}>💎 Go Premium</Text>
          <Text style={styles.body}>Your 90-day Action Plan, debt payoff strategy & monthly check-ins.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  textWrap: { flex: 1, marginRight: Spacing.sm },
  title: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.callout.fontSize, color: Colors.primary, marginBottom: Spacing.xs },
  body: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.primary, fontWeight: '300' },
});
