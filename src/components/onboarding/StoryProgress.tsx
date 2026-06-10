// Instagram-Stories-style segmented progress for onboarding Act 1. The ACTIVE segment fills live
// over `duration` (it IS the auto-advance timer — when it completes it calls onComplete, so the bar
// and the transition are always in sync). Past segments are full, future are empty. Restarts when
// `index` changes (manual tap-zone nav). Reduced motion: active shows full + a plain timeout.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, useReducedMotion, Easing } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';

export default function StoryProgress({ total, index, duration, onComplete }: {
  total: number; index: number; duration: number; onComplete: () => void;
}) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <Segment
          key={i}
          state={i < index ? 'full' : i === index ? 'active' : 'empty'}
          duration={duration}
          restartKey={index}
          onComplete={onComplete}
        />
      ))}
    </View>
  );
}

function Segment({ state, duration, restartKey, onComplete }: {
  state: 'full' | 'active' | 'empty'; duration: number; restartKey: number; onComplete: () => void;
}) {
  const reduce = useReducedMotion();
  const fill = useSharedValue(state === 'full' ? 1 : 0);

  useEffect(() => {
    if (state === 'full') { fill.value = 1; return; }
    if (state === 'empty') { fill.value = 0; return; }
    // active — fill from 0, advance when it completes
    fill.value = 0;
    if (reduce) {
      fill.value = 1;
      const t = setTimeout(onComplete, duration);
      return () => clearTimeout(t);
    }
    fill.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });
  }, [state, restartKey, reduce]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignSelf: 'stretch' },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.backgroundSecondary, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: Colors.accentSolid, transformOrigin: 'left' },
});
