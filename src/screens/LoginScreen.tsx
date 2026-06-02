import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Image,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { impact, notify, ImpactFeedbackStyle, NotificationFeedbackType } from '@/utils/haptics';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
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
  const [username, setUsername] = useState('');
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
    if (mode === 'signup' && !/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
      Alert.alert('Invalid username', 'Username must be 3–24 characters: lowercase letters, numbers, or underscores.');
      return;
    }

    setLoading(true);
    const { error } = mode === 'login'
      ? await signIn(trimmedEmail, password)
      : await signUp(trimmedEmail, password, username.trim().toLowerCase());
    setLoading(false);
    if (error) {
      Alert.alert(mode === 'login' ? 'Sign in failed' : 'Sign up failed', error);
      return;
    }
    // Signed in — AppNavigator swaps to the app stack automatically (hard auth gate).
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
          <Ionicons name="chevron-back" size={28} color={Colors.tint} />
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
                onPress={() => setMode(m)}
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

          {/* Form */}
          <BlurView intensity={24} tint="dark" style={styles.formGroup}>
            {mode === 'signup' && (
              <>
                <View style={styles.formCell}>
                  <Text style={styles.formLabel}>Username</Text>
                  <AppTextInput
                    style={styles.formInput}
                    placeholder="yourname"
                    placeholderTextColor={Colors.textSecondary}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={24}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.cellSeparator} />
              </>
            )}
            <View style={styles.formCell}>
              <Text style={styles.formLabel}>Email</Text>
              <AppTextInput
                style={styles.formInput}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textSecondary}
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
              <View style={styles.passwordRow}>
                <AppTextInput
                  style={[styles.formInput, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                />
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={HIT} activeOpacity={0.7}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>

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
  segmentActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
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
  formGroup: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight, marginBottom: Spacing.md,
  },
  formCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: Spacing.rowHeight },
  formLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, width: 80 },
  formInput: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, textAlign: 'right' },
  passwordRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { marginRight: Spacing.sm },
  cellSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.lg },
  forgotRow: { alignItems: 'flex-end', paddingVertical: Spacing.xs, marginBottom: Spacing.sm },
  forgotText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.tint },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md, paddingHorizontal: Spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: Radius.xs, borderWidth: 2, borderColor: Colors.glassBorderLight, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontSize: 14, color: Colors.background, fontWeight: '700' },
  termsText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  legalLink: { color: Colors.tint, textDecorationLine: 'underline' },
});
