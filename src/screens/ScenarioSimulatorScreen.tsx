import React from 'react';
import { StyleSheet } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp } from '@/components/motion';
import ScreenBackground from '@/components/ScreenBackground';
import EmptyState from '@/components/EmptyState';

// Intentional stub — flag-parked, and now unreachable from the Finances tab (its row is non-tappable).
// Uses the shared EmptyState (centered) so every coming-soon / empty surface reads the same.
export default function ScenarioSimulatorScreen() {
  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="scenarios" />
      <EmptyState
        center
        emoji="🔮"
        title="Coming Soon"
        body="Scenario simulations are being rebuilt on the new scoring engine. Check back after the next update."
      />
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
