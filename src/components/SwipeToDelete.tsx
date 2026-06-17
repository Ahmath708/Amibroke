import React, { useState } from 'react';
import { StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, clamp } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { TrashIcon } from 'react-native-heroicons/solid';
import { Colors, Radius } from '@/theme/colors';
import { Springs } from '@/theme/motion';
import { selection } from '@/utils/haptics';

const ACTION_W = 80;       // revealed delete-button width (HTML swipe-del ≈ 84)
const OVERSHOOT = 20;      // a little rubber-band past fully open

interface Props {
  children: React.ReactNode;     // the row content (brings its own opaque card bg)
  onDelete: () => void;
  /** Tap on the (closed) row — e.g. open the edit sheet. Tapping an OPEN row closes it instead. */
  onPress?: () => void;
  /** Corner radius to clip to — match the child card's radius (default Radius.xl). */
  radius?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * Swipe-left-to-reveal-delete row (Claude Design manager rows). A horizontal Pan reveals a red
 * trash action behind the row; it snaps open/closed (past half or a fling) and a tap on an open
 * row closes it. Vertical drags defer to the parent ScrollView (`failOffsetY`); taps fall through
 * to `onPress` (`activeOffsetX` gates the pan to real horizontal swipes).
 */
export default function SwipeToDelete({ children, onDelete, onPress, radius = Radius.xl, style, accessibilityLabel }: Props) {
  const tx = useSharedValue(0);
  const openV = useSharedValue(0); // worklet-side base (0 closed, 1 open)
  const [isOpen, setIsOpen] = useState(false);

  const commit = (open: boolean) => setIsOpen(open);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet';
      const base = openV.value ? -ACTION_W : 0;
      tx.value = clamp(base + e.translationX, -(ACTION_W + OVERSHOOT), 0);
    })
    .onEnd((e) => {
      'worklet';
      const open = tx.value < -ACTION_W / 2 || e.velocityX < -600;
      openV.value = open ? 1 : 0;
      tx.value = withSpring(open ? -ACTION_W : 0, Springs.gentle);
      runOnJS(commit)(open);
      if (open) runOnJS(selection)();
    });

  const close = () => { openV.value = 0; tx.value = withSpring(0, Springs.gentle); setIsOpen(false); };
  const handlePress = () => { if (isOpen) { close(); return; } onPress?.(); };
  const handleDelete = () => { close(); onDelete(); };

  const fgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <Animated.View style={[styles.wrap, { borderRadius: radius }, style]}>
      <Pressable style={styles.delete} onPress={handleDelete} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? 'Delete'}>
        <TrashIcon size={20} color={Colors.onAccent} />
      </Pressable>
      <GestureDetector gesture={pan}>
        <Animated.View style={fgStyle}>
          <Pressable onPress={handlePress}>{children}</Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: Colors.danger },
  delete: { position: 'absolute', top: 0, bottom: 0, right: 0, width: ACTION_W, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.danger },
});
