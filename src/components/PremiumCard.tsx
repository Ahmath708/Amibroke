import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  onPress: () => void;
  style?: ViewStyle;
  /** 'go' = free→premium upsell; 'upgrade' = action_plan→Deep Dive. */
  variant?: 'go' | 'upgrade';
}

const COPY = {
  go: { title: '💎 Go Premium', body: 'Unlock your Action Plan, debt tools & deep-dive insights.' },
  upgrade: { title: '💎 Upgrade to Deep Dive', body: 'Add the scenario simulator, debt comparison & PDF report.' },
};

/**
 * Premium upsell banner — the screen's one accent moment: an elevated surface
 * with a subtle accent wash + a bold accent title (follows the swappable accent).
 */
export default function PremiumCard({ onPress, style, variant = 'go' }: Props) {
  const copy = COPY[variant];
  return (
    <PressableScale onPress={onPress} haptic="light" style={style}>
      <LinearGradient
        colors={[Colors.accentContainer, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.textWrap}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
        <ChevronRightIcon size={20} color={Colors.accent} />
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, padding: Spacing.lg,
    backgroundColor: Colors.surfaceElevated, // elevated base under the accent wash
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  textWrap: { flex: 1, marginRight: Spacing.sm },
  title: { fontFamily: Typography.fonts.heading, fontSize: 18, color: Colors.accent, letterSpacing: -0.3, marginBottom: Spacing.xs },
  body: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
});
