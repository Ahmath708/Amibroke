import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WrenchScrewdriverIcon, ChevronRightIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  onPress: () => void;
  style?: ViewStyle;
  /** 'go' = free→first paid tier; 'upgrade' = action_plan→Deep Dive. */
  variant?: 'go' | 'upgrade';
}

// Benefit-led, not "Go Premium" (there's no "Premium" plan — tiers are Action
// Plan / Deep Dive). Frames the upsell as the fix for the roast.
const COPY = {
  go: { title: 'Fix your finances', body: 'Your 90-day plan, debt payoff & deep-dive insights.' },
  upgrade: { title: 'Upgrade to Deep Dive', body: 'Scenario simulator, debt comparison & PDF report.' },
};

/**
 * Upsell banner — the screen's one accent moment: elevated surface + subtle
 * accent wash, a wrench badge ("fix"), and a benefit-led accent title.
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
        <View style={styles.iconBadge}>
          <WrenchScrewdriverIcon size={18} color={Colors.accent} />
        </View>
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
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.lg, padding: Spacing.lg,
    backgroundColor: Colors.surfaceElevated, // elevated base under the accent wash
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  iconBadge: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.accentContainer,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
  },
  textWrap: { flex: 1, marginRight: Spacing.sm },
  title: { fontFamily: Typography.fonts.heading, fontSize: 18, color: Colors.accent, letterSpacing: -0.3, marginBottom: Spacing.xs },
  body: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
});
