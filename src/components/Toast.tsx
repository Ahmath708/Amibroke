import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Durations } from '@/theme/motion';
import { useReducedMotion } from '@/components/motion';

interface Props {
  message: string;
  emoji?: string;
  visible: boolean;
  duration?: number;
  onHide?: () => void;
}

export default function Toast({ message, emoji, visible, duration = 2500, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();

  useEffect(() => {
    if (visible) {
      if (reduce) {
        // Reduce Motion: appear instantly, auto-dismiss after the dwell (no fade).
        opacity.setValue(1);
        const t = setTimeout(() => onHide?.(), duration);
        return () => clearTimeout(t);
      }
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: Durations.normal, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: Durations.normal, useNativeDriver: true }),
      ]).start(() => onHide?.());
    } else {
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 100, left: Spacing.xl, right: Spacing.xl,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  emoji: { fontSize: Typography.headline.fontSize },
  text: {
    flex: 1, fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.subhead.fontSize, color: Colors.textPrimary,
  },
});
