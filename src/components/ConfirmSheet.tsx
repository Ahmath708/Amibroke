import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import BottomSheet from '@/components/BottomSheet';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  visible: boolean;
  /** Dismiss without confirming (backdrop tap, swipe-down, or Cancel). */
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Tints the confirm button with the danger color for irreversible actions. */
  destructive?: boolean;
  /** Show a spinner on confirm + lock both buttons while the action runs. */
  loading?: boolean;
}

/**
 * A short confirm/action prompt rendered as a content-hugging bottom sheet — the in-app
 * replacement for `Alert.alert` two-button confirms. The parent owns visibility and `loading`:
 * keep it open while `onConfirm` runs, then flip `visible` to false. Cancel / backdrop / swipe
 * all call `onClose`.
 */
export default function ConfirmSheet({
  visible, onClose, title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm, destructive, loading,
}: Props) {
  const confirmBg = destructive ? Colors.danger : Colors.accent;
  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable={false}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <PressableScale
          style={[styles.confirm, { backgroundColor: confirmBg }, loading && styles.disabled]}
          onPress={loading ? undefined : onConfirm}
          disabled={loading}
          haptic={destructive ? 'medium' : 'light'}
        >
          {loading ? (
            <ActivityIndicator color={Colors.onAccent} />
          ) : (
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          )}
        </PressableScale>

        <PressableScale style={styles.cancel} onPress={onClose} disabled={loading} haptic="light">
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </PressableScale>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.sm, paddingTop: Spacing.xs },
  title: {
    fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize,
    color: Colors.textPrimary, textAlign: 'center',
  },
  message: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: Spacing.sm,
  },
  confirm: {
    height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  confirmText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.headline.fontSize, color: Colors.onAccent },
  disabled: { opacity: 0.6 },
  cancel: { height: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
});
