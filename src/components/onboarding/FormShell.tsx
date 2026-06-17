// Act 2 (Build) form chrome: header (oversized headline + sub) → scrollable content → bottom dock
// (Back + neon next FAB), keyboard-aware. Shared by the Name / Location / Setup steps. Ref:
// .screen.form / .form-header / .form-content / .form-dock in the Onboarding HTML.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import FormDock from './FormDock';
import { Colors, Typography, Spacing } from '@/theme/colors';

export default function FormShell({
  headline, sub, children, onBack, onNext, canNext,
}: {
  headline: string;
  sub: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.h1}>{headline}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      <View style={styles.dock}>
        <FormDock onBack={onBack} onNext={onNext} canNext={canNext} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingTop: Spacing.xl },
  h1: { fontFamily: Typography.fonts.extrabold, fontSize: 38, letterSpacing: -1.6, lineHeight: 38, color: Colors.textPrimary },
  sub: { fontFamily: Typography.fonts.body, fontSize: 15, lineHeight: 22.5, color: Colors.textSecondary, marginTop: 14 },
  content: { paddingTop: 28, paddingBottom: Spacing.lg },
  dock: { paddingTop: Spacing.sm },
});
