import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Image,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { impact, notify, ImpactFeedbackStyle, NotificationFeedbackType } from '@/utils/haptics';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons'; // kept for the Apple brand logo (no Heroicon)
import { ChevronLeftIcon, EyeIcon, EyeSlashIcon } from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import AppTextInput from '@/components/AppTextInput';
import GoogleLogo from '@/components/GoogleLogo';
import TypingPlaceholder from '@/components/TypingPlaceholder';
import { useAuth } from '@/context/AuthContext';
import { useLegal } from '@/context/LegalContext';
import AuthBackground from '@/components/AuthBackground';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
  route: RouteProp<RootStackParamList, 'Login'>;
};

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };
const TAGLINES = [
  'Get roasted. Get a plan.',
  'Your money, judged in 60 seconds.',
  "Find out if you're actually broke.",
];

export default function LoginScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, signInWithApple, signInWithGoogle } = useAuth();
  const { showLegal } = useLegal();
  const [mode, setMode] = useState<'login' | 'signup'>(route.params?.mode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null); // form-level: server auth failure
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const { animatedStyle } = useEntryAnimation();

  const dismiss = () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Landing'));

  const requireTerms = () => {
    if (termsAgreed) return true;
    notify(NotificationFeedbackType.Warning);
    Alert.alert('One more thing', 'Please agree to the Terms of Service and Privacy Policy first.');
    return false;
  };

  // Two error zones (mobile standard): per-field inline (client validation) + a form-level banner
  // (server auth result). Sign-up validates email FORMAT (a typo'd address = dead account); sign-in
  // only checks non-empty — a bad email folds into the unified failure (never leak which field).
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailErrorFor = (e: string, checkFormat: boolean): string | null => {
    const t = e.trim();
    if (!t) return 'Enter your email';
    if (checkFormat && !EMAIL_RE.test(t)) return 'Enter a valid email (e.g. name@example.com)';
    return null;
  };

  const handleAuth = async () => {
    setFormError(null);
    const eErr = emailErrorFor(email, mode === 'signup'); // format-checked on sign-up only
    const pErr = password.trim() ? null : 'Enter your password';
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) { notify(NotificationFeedbackType.Warning); return; }
    setLoading(true);
    const { error } = mode === 'login'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setLoading(false);
    if (error) {
      notify(NotificationFeedbackType.Error);
      // Auth failure is form-level, not a field. Sign-in: UNIFY (never reveal which credential was
      // wrong — account-enumeration leak). Sign-up: surface the real message (e.g. email already in use).
      setFormError(mode === 'login' ? 'Invalid email or password' : error);
      return;
    }
    // Signed in — AppNavigator swaps to the app stack automatically (hard auth gate).
  };

  // Switching Sign In ↔ Sign Up clears errors — they're mode-specific and would otherwise stick.
  const switchMode = (m: 'login' | 'signup') => {
    setMode(m);
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
  };

  const handleApple = async () => {
    if (!requireTerms()) return;
    setSocialLoading('apple');
    const { error } = await signInWithApple();
    setSocialLoading(null);
    if (error) Alert.alert('Apple Sign-In', error);
  };

  const handleGoogle = async () => {
    if (!requireTerms()) return;
    setSocialLoading('google');
    const { error } = await signInWithGoogle();
    setSocialLoading(null);
    if (error) Alert.alert('Google Sign-In', error);
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <AuthBackground />

      {/* Top bar — back chevron dismisses to Landing */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={dismiss} hitSlop={HIT} style={styles.backBtn} accessibilityLabel="Back">
          <ChevronLeftIcon size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height', default: 'height' })} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Header — horizontal logo lockup + rotating tagline */}
          <View style={styles.header}>
            <View style={styles.lockup}>
              <Image source={require('../../assets/logo-mark.png')} style={styles.logoMark} resizeMode="contain" />
              <Text style={styles.wordmark}>Am I Broke?</Text>
            </View>
            <TypingPlaceholder placeholders={TAGLINES} style={styles.tagline} textStyle={styles.taglineText} />
          </View>

          {/* Segmented control */}
          <View style={styles.segmentRow}>
            {(['login', 'signup'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.segment, mode === m && styles.segmentActive]}
                onPress={() => switchMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Social — official logos, matching pills, stacked (Apple is iOS-only) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.oauthBtn, !termsAgreed && styles.oauthDim]}
              onPress={handleApple}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={22} color="#000000" />
              <Text style={styles.oauthLabel}>
                {socialLoading === 'apple' ? 'Signing in…' : `${mode === 'login' ? 'Sign In' : 'Sign Up'} with Apple`}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.oauthBtn, !termsAgreed && styles.oauthDim]}
            onPress={handleGoogle}
            activeOpacity={0.85}
          >
            <GoogleLogo size={18} />
            <Text style={styles.oauthLabel}>
              {socialLoading === 'google' ? 'Signing in…' : `${mode === 'login' ? 'Sign In' : 'Sign Up'} with Google`}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>or</Text>
            <View style={styles.divLine} />
          </View>

          {/* Form — separate fields so each owns its inline error (mobile standard) */}
          <View style={styles.field}>
            <BlurView intensity={24} tint="dark" style={[styles.fieldCard, emailError ? styles.fieldCardError : null]}>
              <Text style={styles.formLabel}>Email</Text>
              <AppTextInput
                style={styles.formInput}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null); if (formError) setFormError(null); }}
                onBlur={() => { if (mode === 'signup' && email.trim()) setEmailError(emailErrorFor(email, true)); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </BlurView>
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          </View>

          <View style={styles.field}>
            <BlurView intensity={24} tint="dark" style={[styles.fieldCard, passwordError ? styles.fieldCardError : null]}>
              <Text style={styles.formLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <AppTextInput
                  style={[styles.formInput, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textSecondary}
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(null); if (formError) setFormError(null); }}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                />
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={HIT} activeOpacity={0.7}>
                  {showPassword
                    ? <EyeSlashIcon size={20} color={Colors.textSecondary} />
                    : <EyeIcon size={20} color={Colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </BlurView>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          </View>

          {/* Form-level banner — server auth failure (unified for sign-in; Supabase msg for sign-up) */}
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Terms agreement */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              setTermsAgreed(!termsAgreed);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, termsAgreed && styles.checkboxActive]}>
              {termsAgreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.legalLink} onPress={() => showLegal('terms')}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.legalLink} onPress={() => showLegal('privacy')}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <NeonButton
            label={mode === 'login' ? 'Sign In' : 'Sign Up'}
            onPress={handleAuth}
            loading={loading}
            disabled={!termsAgreed}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs },
  backBtn: { padding: Spacing.xs },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xs },
  header: { alignItems: 'center', marginBottom: Spacing.sm },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoMark: {
    width: 60, height: 60,
  },
  wordmark: {
    fontFamily: Typography.fonts.heading,
    fontSize: Typography.title1.fontSize, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: -0.5, textAlign: 'center',
  },
  tagline: { marginTop: Spacing.xs, justifyContent: 'center' },
  taglineText: { fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  segmentRow: {
    flexDirection: 'row', backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md, padding: Spacing.xs, marginBottom: Spacing.sm,
  },
  segment: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent' },
  segmentActive: { backgroundColor: Colors.accentContainer, borderColor: Colors.accent },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  oauthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    height: 48, borderRadius: Radius.lg, backgroundColor: '#FFFFFF', marginBottom: Spacing.sm,
  },
  oauthLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: '#1F1F1F', fontWeight: '600' },
  oauthDim: { opacity: 0.45 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs, marginBottom: Spacing.md },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  divText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textMuted },
  // Separate fields (each its own blur card) so per-field errors have room + a clean red-border state.
  field: { marginBottom: Spacing.md },
  fieldCard: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    minHeight: Spacing.rowHeight, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg,
    overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  fieldCardError: { borderColor: Colors.danger },
  formLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, width: 80 },
  formInput: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, textAlign: 'right' },
  passwordRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { marginRight: Spacing.sm },
  fieldError: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.danger, marginTop: Spacing.xs, marginLeft: Spacing.xs },
  formError: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.danger, textAlign: 'center', marginBottom: Spacing.md },
  forgotRow: { alignItems: 'flex-end', paddingVertical: Spacing.xs, marginBottom: Spacing.sm },
  forgotText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.accent },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md, paddingHorizontal: Spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: Radius.xs, borderWidth: 2, borderColor: Colors.glassBorderLight, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkmark: { fontSize: 14, color: Colors.background, fontWeight: '700' },
  termsText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  legalLink: { color: Colors.accent, textDecorationLine: 'underline' },
});
