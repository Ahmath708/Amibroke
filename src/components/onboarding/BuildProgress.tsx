// Act 2 (Build) continuous progress bar — a thin neon fill that animates to step/total. Replaces the
// Stories segments used in Act 1. Ref: .progress / .fill in the Onboarding HTML.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';

export default function BuildProgress({ step, total }: { step: number; total: number }) {
  const w = useSharedValue(step / total);
  useEffect(() => {
    w.value = withTiming(step / total, { duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [step, total]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: 'stretch', height: 3, backgroundColor: 'rgba(255,255,255,0.07)' },
  fill: {
    height: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: Colors.accentSolid,
    shadowColor: Colors.accentSolid, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
  },
});
