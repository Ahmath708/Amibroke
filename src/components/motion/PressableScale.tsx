import React from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { Scale, Springs } from '@/theme/motion';
import { impact, ImpactFeedbackStyle } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HapticKind = 'light' | 'medium' | 'heavy';

function impactFor(kind: HapticKind): ImpactFeedbackStyle {
  if (kind === 'heavy') return ImpactFeedbackStyle.Heavy;
  if (kind === 'medium') return ImpactFeedbackStyle.Medium;
  return ImpactFeedbackStyle.Light;
}

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale on press-in. Defaults to the press token (0.96). */
  scaleTo?: number;
  /** Haptic on press-in. `false` to disable. Defaults to a light tap. */
  haptic?: false | HapticKind;
};

/**
 * Tactile pressable: springs to `scaleTo` on press-in and back on release, with
 * a paired haptic. The single source of "things feel alive when you touch them."
 * Honors Reduce Motion (skips the scale, keeps the haptic).
 */
export function PressableScale({
  style,
  scaleTo = Scale.press,
  haptic = 'light',
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e: GestureResponderEvent) => {
        if (!reduce) scale.value = withSpring(scaleTo, Springs.snappy);
        if (haptic) impact(impactFor(haptic));
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        if (!reduce) scale.value = withSpring(1, Springs.snappy);
        onPressOut?.(e);
      }}
    />
  );
}
