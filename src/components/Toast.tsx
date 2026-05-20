import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  message: string;
  emoji?: string;
  visible: boolean;
  duration?: number;
  onHide?: () => void;
}

export default function Toast({ message, emoji, visible, duration = 2500, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
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
