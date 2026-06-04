import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { isLockEnabled, authenticate } from '@/services/biometric';

// Don't re-prompt if the app was only backgrounded briefly (quick app-switches).
const GRACE_MS = 30_000;

/**
 * Wraps the app. When the user has enabled the biometric lock, requires Face ID /
 * Touch ID on cold start and on return from background. An opaque cover hides
 * content until unlocked, so financial data never flashes behind the prompt.
 */
export default function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const backgroundedAt = useRef<number | null>(null);

  const tryUnlock = useCallback(async () => {
    const ok = await authenticate('Unlock Am I Broke?');
    if (ok) setLocked(false);
  }, []);

  // Cold start.
  useEffect(() => {
    (async () => {
      const enabled = await isLockEnabled();
      setChecking(false);
      if (enabled) {
        setLocked(true);
        tryUnlock();
      }
    })();
  }, [tryUnlock]);

  // Re-lock on return from background (after the grace period).
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') {
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now();
      } else if (s === 'active') {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (locked) return;
        if (away > GRACE_MS && (await isLockEnabled())) {
          setLocked(true);
          tryUnlock();
        }
      }
    });
    return () => sub.remove();
  }, [locked, tryUnlock]);

  const gated = checking || locked;
  return (
    <View style={styles.root}>
      {children}
      {gated && (
        <View style={styles.overlay}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={36} color={Colors.accent} />
          </View>
          {locked && (
            <>
              <Text style={styles.title}>Locked</Text>
              <Text style={styles.subtitle}>Unlock to access your finances.</Text>
              <TouchableOpacity style={styles.unlockBtn} onPress={tryUnlock} activeOpacity={0.85}>
                <Text style={styles.unlockText}>Unlock with Face ID</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  lockIcon: {
    width: 72, height: 72, borderRadius: Radius.xxl,
    backgroundColor: Colors.accentContainer, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  unlockBtn: {
    marginTop: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Radius.pill, backgroundColor: Colors.accentContainer,
    borderWidth: 1, borderColor: Colors.accent,
  },
  unlockText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.accent, fontWeight: '600' },
});
