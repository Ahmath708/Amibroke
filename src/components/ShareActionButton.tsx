import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { CheckIcon } from 'react-native-heroicons/outline';
import { PressableScale, useReducedMotion } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Durations, Springs, Scale } from '@/theme/motion';

/** How long the success state (check + "Saved"/"Copied") lingers before reverting. */
const CONFIRM_HOLD_MS = 1600;

type IconType = React.ComponentType<{ size?: number; color?: string }>;

type Props = {
  /** Default (resting) icon. Morphs to a check while the success state shows. */
  icon: IconType;
  label: string;
  /** When set, a `true` from `onPress` morphs the tile to a check + this label. Omit for no confirm (e.g. Share → OS sheet). */
  successLabel?: string;
  /** Return `true` to trigger the success morph (e.g. only on a real save, not a permission denial). */
  onPress: () => Promise<boolean | void>;
  disabled?: boolean;
};

/**
 * Action tile (icon over label) for the share row, with the inline success confirmation the Copy
 * button pioneered: icon → check, label → successLabel, tint → success, a quick bump, then revert.
 * One component for Share / Save / Copy so the confirm feel is identical everywhere.
 */
export default function ShareActionButton({ icon: Icon, label, successLabel, onPress, disabled }: Props) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const pop = useSharedValue(1);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await onPress();
      if (ok === true && successLabel) {
        setDone(true);
        if (!reduce) pop.value = withSequence(withTiming(Scale.bump, { duration: Durations.fast }), withSpring(1, Springs.bouncy));
        setTimeout(() => setDone(false), CONFIRM_HOLD_MS);
      }
    } finally {
      setBusy(false);
    }
  };

  const showSuccess = done && !!successLabel;

  return (
    <PressableScale style={styles.btn} onPress={handle} disabled={disabled || busy}>
      <ReAnimated.View style={iconStyle}>
        {showSuccess ? <CheckIcon size={24} color={Colors.success} /> : <Icon size={24} color={Colors.textPrimary} />}
      </ReAnimated.View>
      <Text style={[styles.label, showSuccess && { color: Colors.success }]}>{showSuccess ? successLabel : label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
  },
  label: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
});
