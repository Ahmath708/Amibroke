import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';
import FinancialContextForm, { ContextValues, CTX_COLUMNS, valuesFromProfile, profileUpdateFromValues, parseIncome } from '@/components/FinancialContextForm';
import { useAuth } from '@/context/AuthContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'FinancialContext'> };

export default function FinancialContextScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, supabase } = useAuth();
  const [initial, setInitial] = useState<ContextValues | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setInitial({}); return; }
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select(CTX_COLUMNS).eq('id', user.id).maybeSingle();
        const values = valuesFromProfile(data as Record<string, unknown> | null);
        // Optional exact income — separate, non-fatal read: monthly_income (00021) may be unpushed.
        try {
          const { data: mi } = await supabase.from('profiles').select('monthly_income').eq('id', user.id).maybeSingle();
          const n = (mi as Record<string, unknown> | null)?.monthly_income;
          if (typeof n === 'number' && n > 0) values.incomeExact = String(Math.round(n));
        } catch { /* column may not exist yet */ }
        setInitial(values);
      } catch {
        setInitial({});
      }
    })();
  }, [user]);

  const save = async (values: ContextValues) => {
    setSaving(true);
    try {
      if (user) {
        await supabase.from('profiles').update(profileUpdateFromValues(values)).eq('id', user.id);
        // Optional exact income — separate, non-fatal write (monthly_income / 00021 may be unpushed).
        try {
          const { error } = await supabase.from('profiles').update({ monthly_income: parseIncome(values.incomeExact) }).eq('id', user.id);
          if (error) console.warn('[financial-context] monthly_income not persisted (push 00021):', error.message);
        } catch { /* column may not exist yet */ }
      }
    } catch (e) {
      console.warn('[financial-context] save failed:', e);
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      {!initial ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            This personalizes your score and plan against state and demographic baselines. All optional.
          </Text>
          <FinancialContextForm
            initial={initial}
            submitLabel="Save"
            submitting={saving}
            onSubmit={save}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.xl },
  subtitle: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.xl,
  },
});
