// Shared Claude-Design tappable picker field (the .ofield.tappable look): a floating label, the
// chosen value or placeholder, and a chevron — with a neon focus glow while its sheet is open.
// Used by StateSelect + DobField (and reused on the Life Context screen). Ref: .ofield.tappable.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';
import { ChevronDownIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Radius } from '@/theme/colors';

const FOCUS_BG = '#181822';

export default function PickerField({
  label, value, placeholder, onPress, active,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  active?: boolean;
}) {
  const fc = useSharedValue(0);
  useEffect(() => { fc.value = withTiming(active ? 1 : 0, { duration: 200 }); }, [active]);

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(fc.value, [0, 1], [Colors.glassBorder, Colors.accentSolid]),
    backgroundColor: interpolateColor(fc.value, [0, 1], [Colors.backgroundSecondary, FOCUS_BG]),
    shadowOpacity: 0.35 * fc.value,
  }));

  return (
    <PressableScale onPress={onPress} style={styles.wrap}>
      <Animated.View style={[styles.box, boxStyle]}>
        <Text style={[styles.label, active ? styles.labelActive : null]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.val, !value && styles.valPh]} numberOfLines={1}>{value || placeholder}</Text>
        <ChevronDownIcon size={18} color={Colors.textTertiary} style={styles.chev} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  box: {
    height: 60, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder,
    backgroundColor: Colors.backgroundSecondary, justifyContent: 'center',
    shadowColor: Colors.accentSolid, shadowOpacity: 0, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  label: { position: 'absolute', left: 17, top: 9, fontFamily: Typography.fonts.bodySemi, fontSize: 12, letterSpacing: -0.1, color: Colors.textTertiary },
  labelActive: { color: Colors.accentSolid },
  val: { position: 'absolute', left: 17, right: 42, top: 26, fontFamily: Typography.fonts.bodyMed, fontSize: 16, letterSpacing: -0.2, color: Colors.textPrimary },
  valPh: { color: Colors.textTertiary },
  chev: { position: 'absolute', right: 15 },
});
