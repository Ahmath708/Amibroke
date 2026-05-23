import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

export function useEntryAnimation(delay = 0) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return {
    animatedStyle: {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    },
  };
}
