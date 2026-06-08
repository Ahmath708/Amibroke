import React from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { Durations } from '@/theme/motion';
import { useReducedMotion } from '@/components/motion';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** delay in ms before the fade starts (for staggered reveals) */
  delay?: number;
};

export function GlassSection({ children, style, delay = 0 }: Props) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(12)).current;
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce) {
      // Reduce Motion: present immediately, no fade/slide.
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Durations.normal,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: Durations.normal,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

