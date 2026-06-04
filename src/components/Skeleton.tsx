import React, { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, useReducedMotion, Easing,
} from 'react-native-reanimated';
import { Colors, Radius } from '@/theme/colors';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Modern loading placeholder — a soft opacity-pulsing block (Reanimated 4). Compose
 * these to mirror a screen's real layout so content swaps in without a jump. Honors
 * Reduce Motion (renders a static dim block). Use instead of a bare spinner on
 * data-loading screens.
 */
export default function Skeleton({ width = '100%', height = 14, radius = Radius.sm, style }: Props) {
  const reduce = useReducedMotion();
  const o = useSharedValue(reduce ? 0.6 : 0.45);

  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [reduce]);

  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));

  return <Animated.View style={[styles.block, { width, height, borderRadius: radius }, pulse, style]} />;
}

const styles = StyleSheet.create({
  block: { backgroundColor: Colors.surfaceElevated },
});
