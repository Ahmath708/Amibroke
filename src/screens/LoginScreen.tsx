import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import { useAuth, consumePendingRedirect } from '@/context/AuthContext';
import ScreenBackground from '@/components/ScreenBackground';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, signInWithApple, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const { animatedStyle } = useEntryAnimation();

  const handleAuth = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address (e.g., name@example.com).');
      return;
    }

    setLoading(true);
    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(trimmedEmail, password);
    setLoading(false);
    if (error) {
      Alert.alert('Authentication failed', error);
      return;
    }
    const redirect = consumePendingRedirect();
    if (redirect) {
      navigation.replace(redirect.to as any, redirect.params);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MainTabs');
    }
  };

  const handleApple = async () => {
    setSocialLoading('apple');
    const { error } = await signInWithApple();
    setSocialLoading(null);
    if (error) {
      Alert.alert('Apple Sign-In', error);
      return;
    }
    const redirect = consumePendingRedirect();
    if (redirect) {
      navigation.replace(redirect.to as any, redirect.params);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MainTabs');
    }
  };

  const handleGoogle = async () => {
    setSocialLoading('google');
    const { error } = await signInWithGoogle();
    setSocialLoading(null);
    if (error) {
      Alert.alert('Google Sign-In', error);
      return;
    }
    const redirect = consumePendingRedirect();
    if (redirect) {
      navigation.replace(redirect.to as any, redirect.params);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MainTabs');
    }
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="login" />
      {/* Drag handle for modal */}
      <View style={[styles.dragHandle, { marginTop: insets.top > 0 ? 8 : 16 }]}>
        <View style={styles.handle} />
      </View>

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height', default: 'height' })} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoMini}>
              <Text style={styles.logoEmoji}>💸</Text>
            </View>
            <Text style={styles.title}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? 'Sign in to your account' : 'Join 100k+ financially aware Gen Z'}
            </Text>
          </View>

          {/* Segmented control */}
          <View style={styles.segmentRow}>
            {(['login', 'signup'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.segment, mode === m && styles.segmentActive]}
                onPress={() => setMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'login' ? 'Log In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Social buttons — Apple is iOS-only (native Sign in with Apple) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialBtn, !termsAgreed && styles.socialBtnDisabled]}
              onPress={handleApple}
              disabled={!termsAgreed || socialLoading !== null}
              activeOpacity={0.75}
            >
              <Text style={[styles.socialIcon, !termsAgreed && styles.socialIconDisabled]}>🍎</Text>
              <Text style={[styles.socialLabel, !termsAgreed && styles.socialLabelDisabled]}>
                {!termsAgreed ? 'Agree to terms first' : socialLoading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.socialBtn, !termsAgreed && styles.socialBtnDisabled]}
            onPress={handleGoogle}
            disabled={!termsAgreed || socialLoading !== null}
            activeOpacity={0.75}
          >
            <Text style={[styles.socialIcon, !termsAgreed && styles.socialIconDisabled]}>G</Text>
            <Text style={[styles.socialLabel, !termsAgreed && styles.socialLabelDisabled]}>
              {!termsAgreed ? 'Agree to terms first' : socialLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>or</Text>
            <View style={styles.divLine} />
          </View>

          {/* Form — iOS inset grouped style */}
          <View style={styles.formGroup}>
            <View style={styles.formCell}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                style={styles.formInput}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
            <View style={styles.cellSeparator} />
            <View style={styles.formCell}>
              <Text style={styles.formLabel}>Password</Text>
              <TextInput
                style={styles.formInput}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleAuth}
              />
            </View>
          </View>

          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Terms agreement */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTermsAgreed(!termsAgreed);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, termsAgreed && styles.checkboxActive]}>
              {termsAgreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.legalLink} onPress={() => navigation.navigate('TermsOfService')}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text style={styles.legalLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          <NeonButton
            label={mode === 'login' ? 'Sign In' : 'Create Account'}
            onPress={handleAuth}
            loading={loading}
            disabled={!termsAgreed}
            style={styles.ctaBtn}
          />

          <TouchableOpacity onPress={() => navigation.replace('Landing')} style={styles.skipRow}>
            <Text style={styles.skipText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dragHandle: { alignItems: 'center', paddingBottom: Spacing.sm },
  handle: { width: 36, height: 5, borderRadius: Radius.pill, backgroundColor: Colors.separator },
  scroll: { paddingHorizontal: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing.xxl, marginTop: Spacing.sm },
  logoMini: {
    width: 64, height: 64, borderRadius: Radius.xxl,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primarySolid, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  logoEmoji: { fontSize: Typography.title1.fontSize },
  title: {
    fontFamily: Typography.fonts.heading,
    fontSize: Typography.title1.fontSize, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize, color: Colors.textSecondary,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  segment: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Colors.groupedRow },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.sm,
  },
  socialIcon: { fontSize: Typography.headline.fontSize, color: Colors.textPrimary, width: 22, textAlign: 'center' },
  socialLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  socialBtnDisabled: { opacity: 0.4 },
  socialIconDisabled: { opacity: 0.5 },
  socialLabelDisabled: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.lg },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  divText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textMuted },
  formGroup: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    marginBottom: Spacing.sm,
  },
  formCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: Spacing.rowHeight },
  formLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, width: 80 },
  formInput: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, textAlign: 'right' },
  cellSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.lg },
  forgotRow: { alignItems: 'flex-end', paddingVertical: Spacing.xs, marginBottom: Spacing.xl },
  forgotText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.tint },
  termsRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.lg, paddingHorizontal: Spacing.xs,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: Radius.xs,
    borderWidth: 2, borderColor: Colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: 14, color: Colors.background, fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontFamily: Typography.fonts.body,
    fontSize: Typography.caption1.fontSize, color: Colors.textSecondary,
    lineHeight: 18,
  },
  ctaBtn: { marginBottom: Spacing.md },
  skipRow: { alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.md },
  skipText: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  legalLink: { color: Colors.tint, textDecorationLine: 'underline' },
});
