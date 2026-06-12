import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const DURATION = 240; // ms — snappier than the native animated scroll-to-top (which has no speed knob)

/**
 * Faster scroll-to-top on active-tab re-tap. The native `useScrollToTop` animation isn't
 * speed-adjustable, so we track the scroll offset (via the returned onScroll handler) and drive a
 * short ease-out scroll ourselves. Attach the returned handler to the tab's scroll view with
 * `scrollEventThrottle={16}`. Works for ScrollView (`scrollTo`) and FlatList (`scrollToOffset`).
 */
export function useScrollToTopFast(ref: React.RefObject<any>) {
  const navigation = useNavigation();
  const offset = useRef(0);
  const animating = useRef(false);

  useEffect(() => {
    const unsub = (navigation as any).addListener('tabPress', () => {
      if (!navigation.isFocused() || animating.current) return;
      const node = ref.current;
      const start = offset.current;
      if (!node || start <= 1) return;
      const setY = node.scrollTo
        ? (y: number) => node.scrollTo({ y, animated: false })
        : node.scrollToOffset
          ? (y: number) => node.scrollToOffset({ offset: y, animated: false })
          : null;
      if (!setY) return;
      animating.current = true;
      const t0 = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - t0) / DURATION);
        setY(start * (1 - t) ** 3); // ease-out toward 0 (fast start, gentle settle)
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          offset.current = 0;
          animating.current = false;
        }
      };
      requestAnimationFrame(step);
    });
    return unsub;
  }, [navigation, ref]);

  // Track the live offset (skip while our own animation is driving the scroll).
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!animating.current) offset.current = e.nativeEvent.contentOffset.y;
  }, []);
}
