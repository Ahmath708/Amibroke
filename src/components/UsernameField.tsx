import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckCircleIcon, XCircleIcon } from 'react-native-heroicons/solid';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';

const USERNAME_REGEX = /^[a-z0-9_]+$/;
const MIN = 3;
const MAX = 24;

type Status = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

/** Validate the format only (length + charset). '' (empty) is treated as not-yet-typed. */
function formatHint(v: string): string {
  if (v.length === 0) return '';
  if (v.length < MIN) return `At least ${MIN} characters`;
  if (!USERNAME_REGEX.test(v)) return 'Lowercase letters, numbers, underscores only';
  return '';
}

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  /** Fires whenever the handle's availability resolves — the parent gates "Continue" on `valid`. */
  onValidChange?: (valid: boolean) => void;
}

/** `@handle` input with a debounced availability check. Normalizes input to the allowed charset,
 *  shows live status (checking / available / taken), and reports validity to the parent. */
export default function UsernameField({ value, onChangeText, onValidChange }: Props) {
  const { supabase } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValid = (valid: boolean) => onValidChange?.(valid);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const v = value.trim();
    if (v.length === 0) { setStatus('idle'); setValid(false); return; }
    if (v.length < MIN || v.length > MAX || !USERNAME_REGEX.test(v)) { setStatus('invalid'); setValid(false); return; }

    setStatus('checking'); setValid(false);
    timer.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('is_username_available', { p_username: v });
        if (error) { setStatus('error'); setValid(false); return; }
        const available = data !== false;
        setStatus(available ? 'available' : 'taken');
        setValid(available);
      } catch {
        setStatus('error'); setValid(false);
      }
    }, 450);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, supabase]);

  const hint = status === 'taken' ? 'That handle is taken — try another.'
    : status === 'available' ? 'Available'
    : status === 'error' ? "Couldn't check — we'll confirm when you continue."
    : formatHint(value.trim());

  const hintColor = status === 'available' ? Colors.success : status === 'taken' || status === 'invalid' ? Colors.danger : Colors.textMuted;

  return (
    <View style={styles.container}>
      <View style={[styles.row, status === 'taken' || status === 'invalid' ? styles.rowError : status === 'available' ? styles.rowOk : null]}>
        <Text style={styles.at}>@</Text>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, MAX))}
          placeholder="yourhandle"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={MAX}
          selectionColor={Colors.accent}
          style={styles.input}
        />
        {status === 'checking' && <ActivityIndicator size="small" color={Colors.textSecondary} />}
        {status === 'available' && <CheckCircleIcon size={18} color={Colors.success} />}
        {(status === 'taken' || status === 'invalid') && <XCircleIcon size={18} color={Colors.danger} />}
      </View>
      {hint ? <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' }, // fill parent width even in flex-start/centered layouts (onboarding) so the flex:1 input doesn't collapse
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    paddingHorizontal: Spacing.md,
  },
  rowError: { borderColor: Colors.danger },
  rowOk: { borderColor: Colors.success },
  at: { fontFamily: Typography.fonts.heading, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  input: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, paddingVertical: Spacing.md, paddingHorizontal: 2, letterSpacing: 0.3 },
  hint: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, marginTop: Spacing.xs, marginLeft: Spacing.xs },
});
