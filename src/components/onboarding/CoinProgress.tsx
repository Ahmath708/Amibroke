// Coin-fill progress for onboarding Act 2 — a row of "coins" that light up accent (with a glow) as
// each question is answered, replacing the flat segment bar. Animated fill; static under reduced motion.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { Springs } from '@/theme/motion';

function Coin({ filled, index, reduce }: { filled: boolean; index: number; reduce: boolean }) {
  const v = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    v.value = reduce ? (filled ? 1 : 0) : withSpring(filled ? 1 : 0, Springs.gentle);
  }, [filled, reduce]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: v.value > 0.5 ? Colors.accent : Colors.backgroundSecondary,
    transform: [{ scale: 0.85 + v.value * 0.15 }],
    shadowOpacity: v.value * 0.8,
  }));
  return <Animated.View style={[styles.coin, style]} />;
}

export default function CoinProgress({ total, filled }: { total: number; filled: number }) {
  const reduce = useReducedMotion();
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <Coin key={i} index={i} filled={i < filled} reduce={reduce} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  coin: {
    flex: 1, height: 8, borderRadius: 4,
    shadowColor: Colors.accentSolid, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
});
