import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import NeonButton from '../components/NeonButton';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); navigation.replace('Home'); }, 1400);
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      {/* Drag handle for modal */}
      <View style={[styles.dragHandle, { marginTop: insets.top > 0 ? 8 : 16 }]}>
        <View style={styles.handle} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
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

          {/* Social buttons */}
          <TouchableOpacity style={styles.socialBtn} onPress={handleAuth} activeOpacity={0.75}>
            <Text style={styles.socialIcon}>🍎</Text>
            <Text style={styles.socialLabel}>Continue with Apple</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} onPress={handleAuth} activeOpacity={0.75}>
            <Text style={[styles.socialIcon, { fontWeight: '700' }]}>G</Text>
            <Text style={styles.socialLabel}>Continue with Google</Text>
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

          <NeonButton
            label={mode === 'login' ? 'Sign In' : 'Create Account'}
            onPress={handleAuth}
            loading={loading}
            style={styles.ctaBtn}
          />

          <TouchableOpacity onPress={() => navigation.replace('Home')} style={styles.skipRow}>
            <Text style={styles.skipText}>Continue without account</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text style={styles.legalLink}>Terms</Text>
            {' '}and{' '}
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dragHandle: { alignItems: 'center', paddingBottom: 8 },
  handle: { width: 36, height: 5, borderRadius: Radius.pill, backgroundColor: Colors.separator },
  scroll: { paddingHorizontal: Spacing.xl },
  header: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  logoMini: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primarySolid, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 20,
  },
  logoEmoji: { fontSize: 28 },
  title: {
    fontFamily: Typography.fonts.heading,
    fontSize: 28, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 4,
  },
  subtitle: {
    fontFamily: Typography.fonts.body,
    fontSize: 15, color: Colors.textSecondary,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: 20,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Colors.groupedRow },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, paddingVertical: 15, paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 10,
  },
  socialIcon: { fontSize: 18, color: Colors.textPrimary, width: 22, textAlign: 'center' },
  socialLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  divText: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textMuted },
  formGroup: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    marginBottom: 8,
  },
  formCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, minHeight: 48 },
  formLabel: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary, width: 80 },
  formInput: { flex: 1, fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary, textAlign: 'right' },
  cellSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 16 },
  forgotRow: { alignItems: 'flex-end', paddingVertical: 4, marginBottom: 20 },
  forgotText: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.tint },
  ctaBtn: { marginBottom: 12 },
  skipRow: { alignItems: 'center', paddingVertical: 12, marginBottom: 12 },
  skipText: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary },
  legal: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  legalLink: { color: Colors.tint },
});
