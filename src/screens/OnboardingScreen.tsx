import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';
import FinancialContextForm, { ContextValues, profileUpdateFromValues } from '@/components/FinancialContextForm';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, supabase, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const finish = async (values: ContextValues, withContext: boolean) => {
    setSaving(true);
    const update: Record<string, unknown> = { onboarded: true };
    if (withContext) Object.assign(update, profileUpdateFromValues(values));
    try {
      if (user) await supabase.from('profiles').update(update).eq('id', user.id);
    } catch (e) {
      console.warn('[onboarding] save failed:', e);
    }
    // Re-resolve gates → AppNavigator advances into the app.
    refreshProfile();
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="onboarding" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Tell us a bit about you</Text>
        <Text style={styles.subtitle}>
          Optional — it helps us tailor your score and plan. You can skip and add this later.
        </Text>
        <FinancialContextForm
          submitLabel="Save & Continue"
          submitting={saving}
          onSubmit={(v) => finish(v, true)}
          onSkip={() => finish({}, false)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  title: {
    fontFamily: Typography.fonts.heading, fontSize: Typography.title1.fontSize, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: Spacing.xs, letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.xxl,
  },
});
