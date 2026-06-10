// Onboarding v2 (Plan 2) — Story → Build → Payoff. A ground-up presentation rebuild of the
// onboarding, behind FEATURES.ONBOARDING_V2. The DATA/SCORE SPINE is identical to the legacy screen:
// collect names + ctx_* (+ optional exact income) → persist to profiles + seed the snapshot →
// buildRescoreInput → analyzeFinances (score-only) → mergeSnapshot('onboarding', score) → reveal →
// refreshProfile. Only the experience around it is new.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StyleProp, TextStyle } from 'react-native';
import ReAnimated from 'react-native-reanimated';
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
import { CONTEXT_FIELDS, ContextValues, profileUpdateFromValues, labelFor, parseIncome } from '@/components/FinancialContextForm';
import { seedSnapshotFromOnboarding, buildRescoreInput, mergeSnapshot } from '@/services/financialSnapshot';
import { analyzeFinances } from '@/services/ai';
import { useAuth } from '@/context/AuthContext';
import { estimateScore } from '@/components/onboarding/estimateScore';
import InputGlyph, { type GlyphKind } from '@/components/onboarding/InputGlyph';
import CoinProgress from '@/components/onboarding/CoinProgress';
import StoryHero, { type StoryScene } from '@/components/onboarding/StoryHero';
import BrokeCard, { monthYear } from '@/components/onboarding/BrokeCard';
import StoryProgress from '@/components/onboarding/StoryProgress';

const STEP_COUNT = 5;
const optsFor = (key: string) => CONTEXT_FIELDS.find((f) => f.key === key)?.options ?? [];

const STORY: { hero: StoryScene; title: string; sub: string }[] = [
  { hero: 'peel', title: 'Your bank app shows balances.', sub: 'It hides the truth — what you owe, and where it’s quietly going.' },
  { hero: 'dial', title: 'We turn your money into one number.', sub: 'A 0–100 score for how broke you actually are. No spreadsheets.' },
  { hero: 'bloom', title: 'And we don’t sugarcoat it.', sub: 'Answer honestly and watch your score build. Let’s get into it.' },
];

const STEP_GLYPH: GlyphKind[] = ['name', 'location', 'housing', 'income', 'debt'];

// Cycled while the real score computes — keeps the personality going (Gemini: no dead spinner).
const CALC_MESSAGES = [
  "Doing the math you've been avoiding…",
  'Tallying the damage…',
  'Consulting the financial gods…',
  'Crunching your real score…',
];

function reactionFor(score: number): string {
  const label = getScoreBand(score).label;
  if (label === 'Financially Fragile') return "Oof. We've got work to do.";
  if (label === 'Surviving') return "Middle of the pack. Let's climb.";
  if (label === 'Stable') return "Not bad — let's make it better.";
  return "Okay, show-off.";
}

// Light reactive line under the live ring during Act 2.
function microcopy(step: number, sel: ContextValues, estimate: number | null): string {
  if (step === 0) return 'Let’s make this personal.';
  if (step === 4 && sel.debtBracket && sel.debtBracket !== 'none') return "Debt logged — that's pulling the number down.";
  if (step === 4 && sel.liquidSavingsBracket && sel.liquidSavingsBracket !== 'none') return 'A cushion helps. Noted.';
  if (step === 3 && sel.incomeBracket) return 'Money in, logged.';
  if (estimate != null) return 'Your score is taking shape…';
  return 'Answer honestly — the number reacts.';
}

export default function OnboardingV2Screen() {
  const insets = useSafeAreaInsets();
  const { user, supabase, refreshProfile } = useAuth();

  const [stage, setStage] = useState<'story' | 'build' | 'calculating' | 'reveal'>('story');
  const [storyStep, setStoryStep] = useState(0);
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sel, setSel] = useState<ContextValues>({});
  const [incomeExact, setIncomeExact] = useState('');
  const [saving, setSaving] = useState(false);
  const [startScore, setStartScore] = useState<number | null>(null);

  const pick = (key: string, opt: string) => setSel((p) => ({ ...p, [key]: p[key] === opt ? '' : opt }));

  const stepValid = [
    firstName.trim().length > 0 && lastName.trim().length > 0,
    !!sel.state && !!sel.ageBracket,
    !!sel.livingSituation && !!sel.employmentStatus,
    !!sel.incomeBracket || parseIncome(incomeExact) != null,
    !!sel.debtBracket && !!sel.liquidSavingsBracket,
  ][step];

  const estimate = estimateScore(sel, parseIncome(incomeExact));

  // ── Act 1 nav (Stories-style) ── StoryProgress fills the active segment over 7s and drives the
  // auto-advance (looping). Tap-zones step manually: left third = back, right two-thirds = forward.
  // Entering Act 2 is a separate, persistent "Get started" CTA. (Stable callbacks for the worklet.)
  const nextStory = useCallback(() => setStoryStep((s) => (s + 1) % STORY.length), []);
  const prevStory = useCallback(() => setStoryStep((s) => (s - 1 + STORY.length) % STORY.length), []);

  // ── Data spine (identical to legacy) ──
  const persist = async () => {
    if (!user) return;
    const exact = parseIncome(incomeExact);
    const values: ContextValues = { ...sel, incomeExact }; // profileUpdateFromValues derives the bracket from incomeExact
    try {
      await supabase.from('profiles').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...profileUpdateFromValues(values),
        onboarded: true,
      }).eq('id', user.id);
      if (exact != null) {
        const { error } = await supabase.from('profiles').update({ monthly_income: exact }).eq('id', user.id);
        if (error) console.warn('[onboarding-v2] monthly_income not persisted (push 00021):', error.message);
      }
      await seedSnapshotFromOnboarding(user.id, {
        incomeBracket: sel.incomeBracket,
        liquidSavingsBracket: sel.liquidSavingsBracket,
        debtBracket: sel.debtBracket,
      }, exact);
    } catch (e) {
      console.warn('[onboarding-v2] save failed:', e);
    }
  };

  const exitToApp = () => refreshProfile();

  const calculate = async () => {
    if (saving) return;
    setSaving(true);
    setStage('calculating');
    await persist();
    try {
      if (user) {
        const input = await buildRescoreInput(user.id);
        if (input) {
          const analysis = await analyzeFinances(input, 'savage'); // TODO(cost): cheap-model route
          await mergeSnapshot(user.id, {}, 'onboarding', analysis.score);
          setStartScore(analysis.score);
          setStage('reveal');
          setSaving(false);
          return;
        }
      }
    } catch (e) {
      console.warn('[onboarding-v2] starting score failed:', e);
    }
    setSaving(false);
    exitToApp();
  };

  const advance = () => {
    if (!stepValid || saving) return;
    if (step < STEP_COUNT - 1) setStep((s) => s + 1);
    else calculate();
  };
  const goBack = () => {
    if (saving) return;
    if (step === 0) { setStage('story'); setStoryStep(STORY.length - 1); }
    else setStep((s) => s - 1);
  };

  const band = startScore != null ? getScoreBand(startScore) : null;
  const now = new Date();

  return (
    <View style={styles.container}>
      <ScreenBackground variant="onboarding" />
      <View style={[styles.body, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>

        {/* ───────── ACT 1 — STORY ───────── */}
        {stage === 'story' && (
          <>
            <StoryProgress total={STORY.length} index={storyStep} duration={7000} onComplete={nextStory} />
            <View style={styles.storyArea}>
              <ReAnimated.View key={storyStep} entering={enterUp(0)} style={styles.storyInner}>
                <StoryHero scene={STORY[storyStep].hero} />
                <Text style={styles.storyTitle}>{STORY[storyStep].title}</Text>
                <Text style={styles.storySub}>{STORY[storyStep].sub}</Text>
              </ReAnimated.View>
              {/* Stories tap-zones: left third = back, right two-thirds = forward */}
              <Pressable style={[styles.tapZone, styles.tapLeft]} onPress={prevStory} accessibilityLabel="Previous scene" />
              <Pressable style={[styles.tapZone, styles.tapRight]} onPress={nextStory} accessibilityLabel="Next scene" />
            </View>
            <View style={styles.footer}>
              <NeonButton label="Get started" onPress={() => setStage('build')} />
            </View>
          </>
        )}

        {/* ───────── ACT 2 — BUILD ───────── */}
        {stage === 'build' && (
          <>
            <CoinProgress total={STEP_COUNT} filled={step + (stepValid ? 1 : 0)} />

            {/* Pinned live estimate */}
            <View style={styles.liveRing}>
              <ScoreRing score={estimate ?? 0} size={104} showOutOf glow />
              <Text style={styles.liveLabel}>{microcopy(step, sel, estimate)}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <ReAnimated.View key={step} entering={enterUp(0)} style={styles.stepInner}>
                <InputGlyph kind={STEP_GLYPH[step]} />
                {step === 0 && (
                  <Q title="What do we call you?" sub="So the roast hits personal.">
                    <Label>First name</Label>
                    <AppTextInput value={firstName} onChangeText={setFirstName} placeholder="First" placeholderTextColor={Colors.textMuted} autoCapitalize="words" returnKeyType="next" style={styles.input} />
                    <Label gap>Last name</Label>
                    <AppTextInput value={lastName} onChangeText={setLastName} placeholder="Last" placeholderTextColor={Colors.textMuted} autoCapitalize="words" style={styles.input} />
                  </Q>
                )}
                {step === 1 && (
                  <Q title={firstName.trim() ? `Where you at, ${firstName.trim()}?` : 'Where you at?'} sub="Tunes your score to your actual life — not some average.">
                    <Label>State</Label>
                    <View style={styles.field}><StateSelect value={sel.state ?? ''} onChange={(c) => pick('state', c)} /></View>
                    <Chips label="Age" fieldKey="ageBracket" sel={sel} pick={pick} />
                  </Q>
                )}
                {step === 2 && (
                  <Q title="Your setup" sub="Rent, mortgage, or mom's basement — it all counts.">
                    <Chips label="Housing" fieldKey="livingSituation" sel={sel} pick={pick} />
                    <Chips label="Employment" fieldKey="employmentStatus" sel={sel} pick={pick} />
                  </Q>
                )}
                {step === 3 && (
                  <Q title="The money in" sub="Ballpark's fine. Exact if you're feeling brave.">
                    <Chips label="Monthly income" fieldKey="incomeBracket" sel={sel} pick={pick} />
                    <Label gap>Or enter exact (optional)</Label>
                    <MoneyInput value={incomeExact} onChangeValue={setIncomeExact} />
                  </Q>
                )}
                {step === 4 && (
                  <Q title="The damage" sub="Debt and savings — the make-or-break inputs. Then we're in.">
                    <Chips label="Total debt" fieldKey="debtBracket" sel={sel} pick={pick} />
                    <Chips label="Liquid savings" fieldKey="liquidSavingsBracket" sel={sel} pick={pick} />
                  </Q>
                )}
              </ReAnimated.View>
            </ScrollView>

            <View style={styles.footer}>
              <NeonButton label={step < STEP_COUNT - 1 ? 'Continue' : 'Calculate my score'} onPress={advance} disabled={!stepValid} />
              <PressableScale onPress={goBack} style={styles.backBtn}>
                <Text style={styles.backText}>Back</Text>
              </PressableScale>
            </View>
          </>
        )}

        {/* ───────── CALCULATING ───────── */}
        {stage === 'calculating' && (
          <View style={[styles.stage, styles.stageCenter]}>
            <StoryHero scene="dial" />
            <CyclingText messages={CALC_MESSAGES} style={[styles.storySub, styles.calcText]} />
          </View>
        )}

        {/* ───────── ACT 3 — PAYOFF ───────── */}
        {stage === 'reveal' && startScore != null && band && (
          <ScrollView contentContainerStyle={styles.revealScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.revealTop}>
              <ScoreRing score={startScore} size={150} showOutOf reveal />
              <Text style={[styles.revealBand, { color: band.color }]}>{band.label}</Text>
              <Text style={styles.revealReaction}>{reactionFor(startScore)}</Text>
            </View>

            <BrokeCard
              name={firstName.trim() || lastName.trim()}
              score={startScore}
              bandLabel={band.label}
              bandColor={band.color}
              dateStr={monthYear({ month: now.getMonth(), year: now.getFullYear() })}
            />

            <Text style={styles.revealNote}>Your starting estimate — built from ranges. Your first real roast sharpens it.</Text>
            <View style={styles.footer}>
              <NeonButton label="See the real roast →" onPress={exitToApp} />
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── small presentational helpers ──
function Q({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (<><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{sub}</Text>{children}</>);
}
function Label({ children, gap }: { children: React.ReactNode; gap?: boolean }) {
  return <Text style={[styles.fieldLabel, gap && styles.fieldLabelGap]}>{children}</Text>;
}
function Chips({ label, fieldKey, sel, pick }: { label: string; fieldKey: string; sel: ContextValues; pick: (k: string, o: string) => void }) {
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

// Rotates through loading messages so the score calc keeps its personality (vs a dead spinner).
function CyclingText({ messages, style }: { messages: string[]; style?: StyleProp<TextStyle> }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 1700);
    return () => clearInterval(t);
  }, [messages.length]);
  return <Text style={style}>{messages[i]}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.xl },
  // Story (Act 1)
  storyArea: { flex: 1, justifyContent: 'center', marginTop: Spacing.lg },
  storyInner: { alignItems: 'center', gap: Spacing.lg },
  tapZone: { position: 'absolute', top: 0, bottom: 0 },
  tapLeft: { left: 0, width: '33%' },
  tapRight: { right: 0, width: '67%' },
  storyTitle: { fontFamily: Typography.fonts.heading, fontSize: Typography.title1.fontSize, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -0.5, marginTop: Spacing.lg },
  storySub: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.md },
  // Build — live ring
  liveRing: { alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.xs },
  liveLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center' },
  scroll: { flexGrow: 1, paddingBottom: Spacing.lg },
  stepInner: { alignItems: 'flex-start' },
  // Shared text
  title: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.xs, letterSpacing: -0.5 },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.lg },
  field: { marginBottom: Spacing.lg, alignSelf: 'stretch' },
  fieldLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm },
  fieldLabelGap: { marginTop: Spacing.md },
  input: { alignSelf: 'stretch', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Typography.fonts.body, fontSize: Typography.body.fontSize, color: Colors.textPrimary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // Footer / back
  footer: { paddingTop: Spacing.sm },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  backText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  // Calculating
  stage: { flex: 1 },
  stageCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  calcText: { marginTop: Spacing.lg, textAlign: 'center', marginBottom: 0 },
  // Reveal
  revealScroll: { flexGrow: 1, paddingBottom: Spacing.lg },
  revealTop: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, marginBottom: Spacing.xl },
  revealBand: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', marginTop: Spacing.md },
  revealReaction: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, textAlign: 'center' },
  revealNote: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, lineHeight: 18 },
});
