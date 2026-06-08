import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '@/components/motion';
import { Durations } from '@/theme/motion';

/**
 * Centralized screen entrance (fade + slide-up). Honors Reduce Motion — snaps straight to the final
 * state (no travel) so the entrance a11y is consistent across every consumer in one place. Kept on
 * RN Animated deliberately: ~15 screens render the returned style in an RN `Animated.View`; a
 * Reanimated rewrite would ripple to all of them (see docs/redesign/motion-sweep.md).
 */
export function useEntryAnimation(delay = 0) {
  const reduce = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (reduce) {
      // Reduce Motion: present the content immediately, no fade/slide.
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: Durations.slow, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: Durations.slow, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [reduce, delay, fadeAnim, slideAnim]);

  return {
    animatedStyle: {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    },
  };
}
