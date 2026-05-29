import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme/colors';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';

export default function ScenarioSimulatorScreen() {
  const { animatedStyle } = useEntryAnimation();

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="scenarios" />
      <View style={styles.content}>
        <Text style={styles.emoji}>🔮</Text>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.body}>
          Scenario simulations are being rebuilt on the new scoring engine. Check back after the next update.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  emoji: { fontSize: 56, marginBottom: Spacing.lg },
  title: { fontFamily: Typography.fonts.heading, fontSize: Typography.title1.fontSize, color: Colors.textPrimary, marginBottom: Spacing.sm, fontWeight: '700' },
  body: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
});
