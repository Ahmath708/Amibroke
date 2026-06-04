import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChartBarIcon, ClipboardDocumentListIcon, LockClosedIcon } from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';
import AppTextInput from '@/components/AppTextInput';
import SelectableChip from '@/components/SelectableChip';
import StateSelect from '@/components/StateSelect';
import NeonButton from '@/components/NeonButton';
import { CONTEXT_FIELDS, ContextValues, profileUpdateFromValues, labelFor } from '@/components/FinancialContextForm';
import { seedSnapshotFromOnboarding } from '@/services/financialSnapshot';
import { useAuth } from '@/context/AuthContext';

const STEP_COUNT = 5;
const optsFor = (key: string) => CONTEXT_FIELDS.find((f) => f.key === key)?.options ?? [];

// Optional exact monthly income → a positive number, and the bracket it falls in.
const parseIncome = (s: string): number | null => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const incomeBracketFor = (n: number): string =>
  n < 2000 ? 'under_2k' : n < 4000 ? '2k_4k' : n < 6000 ? '4k_6k' : n < 10000 ? '6k_10k' : 'over_10k';

/**
 * Mandatory onboarding (Phase 1 of the unified financial model — see
 * docs/unified-financial-model.md). A trust-first intro, then ~5 grouped steps:
 * name → about you → situation → income → debt & savings. Writes profiles
 * (names + ctx_* + onboarded). No skip.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, supabase, refreshProfile } = useAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sel, setSel] = useState<ContextValues>({});
  const [incomeExact, setIncomeExact] = useState(''); // optional precise monthly income
  const [saving, setSaving] = useState(false);

  const pick = (key: string, opt: string) => setSel((p) => ({ ...p, [key]: opt }));

  // Per-step completeness — every field is mandatory.
  const stepValid = [
    firstName.trim().length > 0 && lastName.trim().length > 0,
    !!sel.state && !!sel.ageBracket,
    !!sel.livingSituation && !!sel.employmentStatus,
    !!sel.incomeBracket || parseIncome(incomeExact) != null, // a bracket OR an exact amount
    !!sel.debtBracket && !!sel.liquidSavingsBracket,
  ][step];

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    const exact = parseIncome(incomeExact);
    // Exact income (if given) is the source of truth → derive the bracket from it.
    const ctx: ContextValues = { ...sel, incomeBracket: exact != null ? incomeBracketFor(exact) : sel.incomeBracket };
    try {
      if (user) {
        await supabase.from('profiles').update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          ...profileUpdateFromValues(ctx),
          onboarded: true,
        }).eq('id', user.id);
        // Optional precise income — separate, non-fatal: the monthly_income column (00021)
        // may not be pushed yet, so a failure here must not block onboarding.
        if (exact != null) {
          const { error } = await supabase.from('profiles').update({ monthly_income: exact }).eq('id', user.id);
          if (error) console.warn('[onboarding] monthly_income not persisted (push migration 00021):', error.message);
        }
        // Seed the unified snapshot (Phase 2a). Non-fatal — table may be unpushed (00022).
        await seedSnapshotFromOnboarding(user.id, {
          incomeBracket: ctx.incomeBracket,
          debtBracket: ctx.debtBracket,
          liquidSavingsBracket: ctx.liquidSavingsBracket,
        }, exact);
      }
    } catch (e) {
      console.warn('[onboarding] save failed:', e);
    }
    refreshProfile(); // gates re-resolve → AppNavigator advances into the app
  };

  const advance = () => {
    if (!stepValid || saving) return;
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else finish();
  };

  const goBack = () => {
    if (saving) return;
    if (step === 0) setShowIntro(true); // first step → back to the intro
    else setStep(step - 1);
  };

  const isLast = step === STEP_COUNT - 1;

  return (
    <View style={styles.container}>
      <ScreenBackground variant="onboarding" />
      <View style={[styles.body, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
        {showIntro ? (
          <>
            <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>First, your money profile.</Text>
              <Text style={styles.subtitle}>~30 seconds — it's what makes everything accurate:</Text>
              <View style={styles.benefits}>
                <BenefitRow Icon={ChartBarIcon} text="A score that fits your real situation" />
                <BenefitRow Icon={ClipboardDocumentListIcon} text="A 90-day plan built around your numbers" />
                <BenefitRow Icon={LockClosedIcon} text="Private — rough ranges are fine, get exact later" />
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <NeonButton label="Set it up" onPress={() => setShowIntro(false)} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.progress}>
              {Array.from({ length: STEP_COUNT }).map((_, i) => (
                <View key={i} style={[styles.seg, i <= step && styles.segOn]} />
              ))}
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {step === 0 && (
                <Step title="What should we call you?" subtitle="So your roasts feel personal.">
                  <Text style={styles.fieldLabel}>First name</Text>
                  <AppTextInput value={firstName} onChangeText={setFirstName} placeholder="First" placeholderTextColor={Colors.textMuted} autoCapitalize="words" returnKeyType="next" style={styles.input} />
                  <Text style={[styles.fieldLabel, styles.fieldLabelGap]}>Last name</Text>
                  <AppTextInput value={lastName} onChangeText={setLastName} placeholder="Last" placeholderTextColor={Colors.textMuted} autoCapitalize="words" style={styles.input} />
                </Step>
              )}
              {step === 1 && (
                <Step title="A bit about you" subtitle="Tunes your score to where you actually are.">
                  <Field label="State"><StateSelect value={sel.state ?? ''} onChange={(c) => pick('state', c)} /></Field>
                  <ChipField label="Age" fieldKey="ageBracket" sel={sel} pick={pick} />
                </Step>
              )}
              {step === 2 && (
                <Step title="Your situation" subtitle="Housing and work shape the advice.">
                  <ChipField label="Housing" fieldKey="livingSituation" sel={sel} pick={pick} />
                  <ChipField label="Employment" fieldKey="employmentStatus" sel={sel} pick={pick} />
                </Step>
              )}
              {step === 3 && (
                <Step title="Your monthly income" subtitle="Pick a range — or enter your exact monthly income.">
                  <ChipField label="Monthly income" fieldKey="incomeBracket" sel={sel} pick={pick} />
                  <Text style={[styles.fieldLabel, styles.fieldLabelGap]}>Or enter exact (optional)</Text>
                  <View style={styles.exactRow}>
                    <Text style={styles.exactDollar}>$</Text>
                    <AppTextInput
                      value={incomeExact} onChangeText={(v) => setIncomeExact(v.replace(/[^0-9]/g, ''))}
                      placeholder="4800" placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad" style={[styles.input, styles.exactInput]}
                    />
                  </View>
                </Step>
              )}
              {step === 4 && (
                <Step title="Debt & savings" subtitle="Last piece — then we're in.">
                  <ChipField label="Total debt" fieldKey="debtBracket" sel={sel} pick={pick} />
                  <ChipField label="Liquid savings" fieldKey="liquidSavingsBracket" sel={sel} pick={pick} />
                </Step>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <NeonButton
                label={isLast ? (saving ? '' : 'Finish') : 'Continue'}
                onPress={advance}
                disabled={!stepValid || saving}
                loading={saving && isLast}
              />
              <TouchableOpacity onPress={goBack} disabled={saving} style={styles.backBtn} activeOpacity={0.7}>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function BenefitRow({ Icon, text }: { Icon: React.ComponentType<{ size?: number; color?: string }>; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitBadge}><Icon size={20} color={Colors.accent} /></View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {children}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipField({ label, fieldKey, sel, pick }: { label: string; fieldKey: string; sel: ContextValues; pick: (k: string, o: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipsWrap}>
        {optsFor(fieldKey).map((opt) => (
          <SelectableChip key={opt} label={labelFor(opt)} active={sel[fieldKey] === opt} onPress={() => pick(fieldKey, opt)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.xl },
  progress: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xl },
  seg: { flex: 1, height: 4, borderRadius: Radius.xs, backgroundColor: Colors.backgroundSecondary },
  segOn: { backgroundColor: Colors.accentSolid },
  scroll: { flexGrow: 1, paddingBottom: Spacing.lg },

  // Pre-onboarding intro (trust + benefits)
  introScroll: { flexGrow: 1, paddingTop: Spacing.xl },
  benefits: { marginTop: Spacing.xl, gap: Spacing.lg },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  benefitBadge: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.accentContainer, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, lineHeight: 21 },

  title: {
    fontFamily: Typography.fonts.heading, fontSize: Typography.title1.fontSize, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: Spacing.xs, letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.xl,
  },
  field: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  fieldLabelGap: { marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Typography.fonts.body,
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  exactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  exactDollar: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textSecondary },
  exactInput: { flex: 1 },
  footer: { paddingTop: Spacing.sm },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  backText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
});
