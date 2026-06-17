import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp, PressableScale } from '@/components/motion';
import { impact, notify, ImpactFeedbackStyle, NotificationFeedbackType } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons'; // kept for the Apple brand logo (no Heroicon)
import { ChevronLeftIcon, EyeIcon, EyeSlashIcon } from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import GoogleLogo from '@/components/GoogleLogo';
import AuthBackground from '@/components/AuthBackground';
import { useAuth } from '@/context/AuthContext';
import { useLegal } from '@/context/LegalContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
  route: RouteProp<RootStackParamList, 'Login'>;
};

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [showPassword, setShowPassword] = useState(false);         // password visibility (eye toggle)
  const [pwRevealed, setPwRevealed] = useState(false);             // progressive reveal of the field
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const isSignup = mode === 'signup';
  const dismiss = () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Landing'));

  // Reveal the password field once a valid email pattern is recognized (matches the reference flow).
  useEffect(() => {
    if (!pwRevealed && EMAIL_RE.test(email.trim())) setPwRevealed(true);
  }, [email, pwRevealed]);

  // Terms gate applies to account creation only — existing users signing in already agreed.
  const requireTerms = () => {
    if (mode === 'login' || termsAgreed) return true;
    notify(NotificationFeedbackType.Warning);
    Alert.alert('One more thing', 'Please agree to the Terms of Service and Privacy Policy first.');
    return false;
  };

  // Sign-up validates email FORMAT (a typo'd address = dead account); sign-in only checks non-empty —
  // a bad email folds into the unified failure (never leak which field).
  const emailErrorFor = (e: string, checkFormat: boolean): string | null => {
    const t = e.trim();
    if (!t) return 'Enter your email';
    if (checkFormat && !EMAIL_RE.test(t)) return 'Enter a valid email (e.g. name@example.com)';
    return null;
  };

  // CTA enables only when the form is genuinely submittable (mirrors the reference's disabled state).
  const emailValid = EMAIL_RE.test(email.trim());
  const passwordOk = isSignup ? password.length >= 6 : password.length >= 1;
  const canSubmit = emailValid && passwordOk && (mode === 'login' || termsAgreed) && !loading;

  const handleAuth = async () => {
    setFormError(null);
    const eErr = emailErrorFor(email, isSignup); // format-checked on sign-up only
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

  const verb = isSignup ? 'Sign Up' : 'Sign In';

  return (
    <View style={styles.container}>
      <AuthBackground />

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        {/* Top bar — back chevron + brand lockup */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <PressableScale onPress={dismiss} haptic="light" style={styles.backBtn} accessibilityLabel="Back">
            <ChevronLeftIcon size={20} color={Colors.textPrimary} />
          </PressableScale>
          <View style={styles.brand}>
            <Image source={require('../../assets/logo-mark.png')} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.brandText}>amibroke<Text style={styles.brandAccent}>?</Text></Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
        >
          {/* Hero — mode-driven */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{isSignup ? 'Your roast starts here.' : 'Welcome back.'}</Text>
            <Text style={styles.heroSub}>
              {isSignup
                ? 'Make an account to get your 0–100 score and your roast.'
                : 'Log in to pick up right where you left off.'}
            </Text>
          </View>

          {/* OAuth — dark pills (Apple is iOS-only) */}
          <View style={styles.oauth}>
            {Platform.OS === 'ios' && (
              <PressableScale onPress={handleApple} haptic="light" style={styles.oauthBtn}>
                <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
                <Text style={styles.oauthLabel}>
                  {socialLoading === 'apple' ? 'Signing in…' : `${verb} with Apple`}
                </Text>
              </PressableScale>
            )}
            <PressableScale onPress={handleGoogle} haptic="light" style={styles.oauthBtn}>
              <GoogleLogo size={18} />
              <Text style={styles.oauthLabel}>
                {socialLoading === 'google' ? 'Signing in…' : `${verb} with Google`}
              </Text>
            </PressableScale>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>or</Text>
            <View style={styles.divLine} />
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            <FloatingLabelInput
              label="Email Address"
              value={email}
              error={!!emailError}
              onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null); if (formError) setFormError(null); }}
              onBlur={() => {
                if (!pwRevealed && email.includes('@')) setPwRevealed(true);
                if (isSignup && email.trim()) setEmailError(emailErrorFor(email, true));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}

            {pwRevealed ? (
              <ReAnimated.View entering={enterUp(0)} style={styles.pwWrap}>
                <FloatingLabelInput
                  label="Password"
                  value={password}
                  error={!!passwordError}
                  onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(null); if (formError) setFormError(null); }}
                  secureTextEntry={!showPassword}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  textContentType={isSignup ? 'newPassword' : 'password'}
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                  hideAccessoryUntilFloated
                  rightAccessory={
                    <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={HIT} activeOpacity={0.7}>
                      {showPassword
                        ? <EyeSlashIcon size={20} color={Colors.textTertiary} />
                        : <EyeIcon size={20} color={Colors.textTertiary} />}
                    </TouchableOpacity>
                  }
                />
                {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
                {!isSignup && (
                  <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </ReAnimated.View>
            ) : null}

            {/* Form-level banner — server auth failure */}
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          </View>

          {/* Spacer pushes the CTA cluster toward the bottom when content is short */}
          <View style={styles.grow} />

          {/* Primary CTA */}
          <NeonButton
            label={isSignup ? 'See how cooked you are' : 'Log in'}
            onPress={handleAuth}
            loading={loading}
            disabled={!canSubmit}
            glow
          />

          {/* Legal — sign-up only */}
          {isSignup && (
            <TouchableOpacity
              style={styles.legal}
              onPress={() => { impact(ImpactFeedbackStyle.Light); setTermsAgreed(!termsAgreed); }}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, termsAgreed && styles.checkboxOn]}>
                {termsAgreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.legalText}>
                I agree to the{' '}
                <Text style={styles.legalLink} onPress={() => showLegal('terms')}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.legalLink} onPress={() => showLegal('privacy')}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>
          )}

          {/* Mode toggle */}
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => switchMode(isSignup ? 'login' : 'signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {isSignup ? 'Already have an account? ' : 'New here? '}
              <Text style={styles.toggleBold}>{isSignup ? 'Log in' : 'Sign up'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 3 },
  brandLogo: { width: 28, height: 28 },
  brandText: { fontFamily: Typography.fonts.heading, fontSize: 15, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  brandAccent: { color: Colors.accentSolid },

  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg },

  hero: { marginBottom: Spacing.xl + Spacing.xs },
  heroTitle: {
    fontFamily: Typography.fonts.extrabold, fontSize: 38, fontWeight: '800',
    color: Colors.textPrimary, letterSpacing: -1.6, lineHeight: 40,
  },
  heroSub: {
    fontFamily: Typography.fonts.body, fontSize: 15, lineHeight: 22,
    color: Colors.textSecondary, marginTop: Spacing.md, maxWidth: 300,
  },

  oauth: { gap: Spacing.sm + 3 },
  oauthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm + 2,
    height: 54, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  oauthLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 15.5, color: Colors.textPrimary, letterSpacing: -0.2 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xl, marginBottom: Spacing.lg },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  divText: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, color: Colors.textTertiary, letterSpacing: 0.4 },

  fields: { gap: Spacing.md },
  pwWrap: { gap: Spacing.md },
  fieldError: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.danger, marginLeft: Spacing.md, marginTop: -Spacing.xs },
  formError: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.danger, textAlign: 'center' },
  forgotRow: { alignSelf: 'flex-end', paddingVertical: Spacing.xs, marginTop: -Spacing.xs },
  forgotText: { fontFamily: Typography.fonts.bodyMed, fontSize: 12.5, color: Colors.textSecondary },

  grow: { flex: 1, minHeight: Spacing.xl },

  legal: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm + 3, marginTop: Spacing.lg },
  checkbox: {
    width: 21, height: 21, borderRadius: 7, marginTop: 1, flexShrink: 0,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.accentSolid, borderColor: Colors.accentSolid },
  checkmark: { fontSize: 12, color: Colors.onAccent, fontWeight: '800' },
  legalText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: 12.5, lineHeight: 19, color: Colors.textTertiary, paddingTop: 1 },
  legalLink: { color: Colors.textSecondary, textDecorationLine: 'underline' },

  toggle: { alignItems: 'center', marginTop: Spacing.lg, paddingVertical: Spacing.xs },
  toggleText: { fontFamily: Typography.fonts.bodyMed, fontSize: 13.5, color: Colors.textSecondary },
  toggleBold: { fontFamily: Typography.fonts.heading, color: Colors.textPrimary, fontWeight: '700' },
});
