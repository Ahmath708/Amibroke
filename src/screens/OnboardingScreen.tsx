import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { ChartBarIcon, ClipboardDocumentListIcon, LockClosedIcon } from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { PressableScale, enterUp } from '@/components/motion';
import ScreenBackground from '@/components/ScreenBackground';
import AppTextInput from '@/components/AppTextInput';
import MoneyInput from '@/components/MoneyInput';
import SelectableChip from '@/components/SelectableChip';
import StateSelect from '@/components/StateSelect';
import NeonButton from '@/components/NeonButton';
import ScoreRing from '@/components/ScoreRing';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { CONTEXT_FIELDS, ContextValues, profileUpdateFromValues, labelFor } from '@/components/FinancialContextForm';
import { seedSnapshotFromOnboarding, buildRescoreInput, mergeSnapshot } from '@/services/financialSnapshot';
import { analyzeFinances } from '@/services/ai';
import { useAuth } from '@/context/AuthContext';

// Cheeky band reaction for the starting-score reveal (welcoming, not mean).
function reactionFor(score: number): string {
  const label = getScoreBand(score).label;
  if (label === 'Financially Fragile') return "Oof. We've got work to do.";
  if (label === 'Surviving') return "Middle of the pack. Let's climb.";
  if (label === 'Stable') return "Not bad — let's make it better.";
  return "Okay, show-off."; // Thriving
}

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
  const [stage, setStage] = useState<'form' | 'ready' | 'calculating' | 'reveal'>('form');
  const [startScore, setStartScore] = useState<number | null>(null);

  const pick = (key: string, opt: string) => setSel((p) => ({ ...p, [key]: opt }));

  // Per-step completeness — every field is mandatory.
  const stepValid = [
    firstName.trim().length > 0 && lastName.trim().length > 0,
    !!sel.state && !!sel.ageBracket,
    !!sel.livingSituation && !!sel.employmentStatus,
    !!sel.incomeBracket || parseIncome(incomeExact) != null, // a bracket OR an exact amount
    !!sel.debtBracket && !!sel.liquidSavingsBracket, // debt + savings together (the score's make-or-break inputs)
  ][step];

  // Save the profile + seed the snapshot (no navigation — the reveal/exit drives that).
  const persistProfile = async () => {
    if (!user) return;
    const exact = parseIncome(incomeExact);
    // Exact income (if given) is the source of truth → derive the bracket from it.
    const ctx: ContextValues = { ...sel, incomeBracket: exact != null ? incomeBracketFor(exact) : sel.incomeBracket };
    try {
      await supabase.from('profiles').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...profileUpdateFromValues(ctx),
        onboarded: true,
      }).eq('id', user.id);
      // Optional precise income — separate, non-fatal: monthly_income (00021) may be unpushed.
      if (exact != null) {
        const { error } = await supabase.from('profiles').update({ monthly_income: exact }).eq('id', user.id);
        if (error) console.warn('[onboarding] monthly_income not persisted (push migration 00021):', error.message);
      }
      // Seed the unified snapshot (Phase 2a). Non-fatal — table may be unpushed (00022). Debt is a
      // coarse `estimated` line so the starting score is debt-aware; the first roast overwrites it.
      await seedSnapshotFromOnboarding(user.id, {
        incomeBracket: ctx.incomeBracket,
        liquidSavingsBracket: ctx.liquidSavingsBracket,
        debtBracket: ctx.debtBracket,
      }, exact);
    } catch (e) {
      console.warn('[onboarding] save failed:', e);
    }
  };

  const exitToApp = () => refreshProfile(); // gates re-resolve → AppNavigator advances into the app

  // The payoff: persist, then run a real snapshot-driven starting score (reuses the re-score path).
  // Score-only — the first typed roast is the full experience. Graceful fallback if it can't score.
  const calculate = async () => {
    if (saving) return;
    setSaving(true);
    setStage('calculating');
    await persistProfile();
    try {
      if (user) {
        const input = await buildRescoreInput(user.id);
        if (input) {
          const analysis = await analyzeFinances(input, 'savage'); // TODO(cost): route to the cheap model (provider param)
          await mergeSnapshot(user.id, {}, 'onboarding', analysis.score); // persist the starting score
          setStartScore(analysis.score);
          setStage('reveal');
          setSaving(false);
          return;
        }
      }
    } catch (e) {
      console.warn('[onboarding] starting score failed:', e);
    }
    setSaving(false);
    exitToApp(); // no dead end if the score can't be computed
  };

  const advance = () => {
    if (!stepValid || saving) return;
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else setStage('ready'); // last data step → the "Ready?" gate (user-initiated reveal)
  };

  const goBack = () => {
    if (saving) return;
    if (step === 0) setShowIntro(true); // first step → back to the intro
    else setStep(step - 1);
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="onboarding" />
      <View style={[styles.body, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
        {showIntro ? (
          <>
            <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Before we roast you… the basics.</Text>
              <Text style={styles.subtitle}>60 seconds. The more you tell us, the sharper your score:</Text>
              <View style={styles.benefits}>
                <BenefitRow Icon={ChartBarIcon} text="A score that fits your real situation" />
                <BenefitRow Icon={ClipboardDocumentListIcon} text="A 90-day plan built around your numbers" />
                <BenefitRow Icon={LockClosedIcon} text="Private — rough ranges are fine, get exact later" />
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <NeonButton label="Let's do this" onPress={() => setShowIntro(false)} />
            </View>
          </>
        ) : stage === 'form' ? (
          <>
            <View style={styles.progress}>
              {Array.from({ length: STEP_COUNT }).map((_, i) => (
                <View key={i} style={[styles.seg, i <= step && styles.segOn]} />
              ))}
            </View>
            <Text style={styles.progressHint}>Step {step + 1} of {STEP_COUNT} · each answer sharpens your score</Text>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <ReAnimated.View key={step} entering={enterUp(0)}>
              {step === 0 && (
                <Step title="What do we call you?" subtitle="So the roast hits personal.">
                  <Text style={styles.fieldLabel}>First name</Text>
                  <AppTextInput value={firstName} onChangeText={setFirstName} placeholder="First" placeholderTextColor={Colors.textMuted} autoCapitalize="words" returnKeyType="next" style={styles.input} />
                  <Text style={[styles.fieldLabel, styles.fieldLabelGap]}>Last name</Text>
                  <AppTextInput value={lastName} onChangeText={setLastName} placeholder="Last" placeholderTextColor={Colors.textMuted} autoCapitalize="words" style={styles.input} />
                </Step>
              )}
              {step === 1 && (
                <Step title={firstName.trim() ? `Nice to meet you, ${firstName.trim()}.` : 'A bit about you'} subtitle="Tunes your score to your actual life — not some average.">
                  <Field label="State"><StateSelect value={sel.state ?? ''} onChange={(c) => pick('state', c)} /></Field>
                  <ChipField label="Age" fieldKey="ageBracket" sel={sel} pick={pick} />
                </Step>
              )}
              {step === 2 && (
                <Step title="Your setup" subtitle="Rent, mortgage, or mom's basement — it all counts.">
                  <ChipField label="Housing" fieldKey="livingSituation" sel={sel} pick={pick} />
                  <ChipField label="Employment" fieldKey="employmentStatus" sel={sel} pick={pick} />
                </Step>
              )}
              {step === 3 && (
                <Step title="The money in" subtitle="Ballpark's fine. Exact if you're feeling brave.">
                  <ChipField label="Monthly income" fieldKey="incomeBracket" sel={sel} pick={pick} />
                  <Text style={[styles.fieldLabel, styles.fieldLabelGap]}>Or enter exact (optional)</Text>
                  <MoneyInput value={incomeExact} onChangeValue={setIncomeExact} />
                </Step>
              )}
              {step === 4 && (
                <Step title="The damage" subtitle="Debt and savings — the make-or-break inputs. Then we're in.">
                  <ChipField label="Total debt" fieldKey="debtBracket" sel={sel} pick={pick} />
                  <ChipField label="Liquid savings" fieldKey="liquidSavingsBracket" sel={sel} pick={pick} />
                </Step>
              )}
              </ReAnimated.View>
            </ScrollView>

            <View style={styles.footer}>
              <NeonButton label="Continue" onPress={advance} disabled={!stepValid} />
              <PressableScale onPress={goBack} style={styles.backBtn}>
                <Text style={styles.backText}>Back</Text>
              </PressableScale>
            </View>
          </>
        ) : stage === 'ready' ? (
          <View style={styles.stage}>
            <View style={styles.stageCenter}>
              <Text style={styles.title}>That's everything{firstName.trim() ? `, ${firstName.trim()}` : ''}.</Text>
              <Text style={styles.subtitle}>Ready for the verdict? We'll crunch a starting score from your profile.</Text>
            </View>
            <View style={styles.footer}>
              <NeonButton label="Calculate my starting score" onPress={calculate} />
              <PressableScale onPress={() => setStage('form')} style={styles.backBtn}>
                <Text style={styles.backText}>Back</Text>
              </PressableScale>
            </View>
          </View>
        ) : stage === 'calculating' ? (
          <View style={[styles.stage, styles.stageCenter]}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={[styles.subtitle, styles.calcText]}>Doing the math you've been avoiding…</Text>
          </View>
        ) : (
          <View style={styles.stage}>
            <View style={styles.stageCenter}>
              {startScore != null && (
                <>
                  <ScoreRing score={startScore} size={168} showOutOf reveal />
                  <Text style={[styles.revealBand, { color: getScoreBand(startScore).color }]}>{getScoreBand(startScore).label}</Text>
                  <Text style={styles.revealReaction}>{reactionFor(startScore)}</Text>
                  <Text style={styles.revealNote}>That's your starting estimate — built from ranges. Your first real roast sharpens it.</Text>
                </>
              )}
            </View>
            <View style={styles.footer}>
              <NeonButton label="See the real roast →" onPress={exitToApp} />
            </View>
          </View>
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
  progress: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  progressHint: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xl },
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
  footer: { paddingTop: Spacing.sm },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  backText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  // Ready / calculating / reveal stages
  stage: { flex: 1 },
  stageCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  calcText: { marginTop: Spacing.lg, textAlign: 'center' },
  revealBand: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', marginTop: Spacing.md },
  revealReaction: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.xs },
  revealNote: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, lineHeight: 18 },
});
