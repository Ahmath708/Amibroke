import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import NeonButton from '@/components/NeonButton';
import ScreenBackground from '@/components/ScreenBackground';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'UsernameSetup'> };

const USERNAME_REGEX = /^[a-z0-9_]+$/;

export default function UsernameSetupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { supabase, user, refreshProfile } = useAuth();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const clientError = (() => {
    const v = value.trim();
    if (v.length === 0) return '';
    if (v.length < 3) return 'Username must be at least 3 characters';
    if (v.length > 24) return 'Username must be 24 characters or less';
    if (!USERNAME_REGEX.test(v)) return 'Only lowercase letters, numbers, and underscores allowed';
    return '';
  })();

  const canSubmit = !submitting && clientError === '' && value.trim().length >= 3;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('set_username', {
      p_username: value.trim().toLowerCase(),
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const result = data as { ok: boolean; username?: string; error?: string } | null;
    if (result?.ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Username set → re-resolve the gate; AppNavigator swaps to the app stack.
      refreshProfile();
    } else if (result?.error === 'taken') {
      setError('That username is taken \u2014 try another.');
    } else if (result?.error === 'invalid_length' || result?.error === 'invalid_charset') {
      setError(result.error === 'invalid_length' ? 'Username must be 3\u201324 characters.' : 'Only lowercase letters, numbers, and underscores allowed.');
    } else if (result?.error === 'not_authenticated') {
      setError('Session expired. Please log in again.');
    } else {
      setError(result?.error || 'Something went wrong. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height', default: 'height' })} style={styles.flex}>
        <View style={[styles.inner, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xl }]}>
          <Text style={styles.title}>Choose a Username</Text>
          <Text style={styles.subtitle}>
            Pick a username to join the community. You can change it later.
          </Text>

          <View style={styles.fieldWrap}>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="username"
              placeholderTextColor={Colors.textMuted}
              value={value}
              onChangeText={(t) => { setValue(t); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Text style={styles.charCounter}>
              {value.length}/24
            </Text>
          </View>

          {error !== '' && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          {error === '' && clientError !== '' && (
            <Text style={styles.clientHint}>{clientError}</Text>
          )}

          <NeonButton
            label={submitting ? 'Saving\u2026' : 'Set Username'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={styles.cta}
          />

        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...Typography.title1,
    fontFamily: Typography.fonts.heading,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.subhead,
    fontFamily: Typography.fonts.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl + Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  fieldWrap: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  input: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.title2.fontSize,
    color: Colors.textPrimary,
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    textAlign: 'center',
    letterSpacing: 1,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  charCounter: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.sm,
    fontFamily: Typography.fonts.body,
    fontSize: Typography.caption1.fontSize,
    color: Colors.textMuted,
  },
  errorText: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  clientHint: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.footnote.fontSize,
    color: Colors.warning,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  cta: {
    marginBottom: Spacing.lg,
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.callout.fontSize,
    color: Colors.textMuted,
  },
});
