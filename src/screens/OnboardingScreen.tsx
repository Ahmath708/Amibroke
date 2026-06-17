// Onboarding — Act 1 Story → Act 2 Build → Act 3 Payoff (Claude Design rebuild). Data/score spine:
// collect names + ctx_* + exact money (income/expenses/debt/savings) → persist to profiles +
// financial_context + seed the snapshot → buildRescoreInput → analyzeFinances (score-only) →
// mergeSnapshot('onboarding', score) → reveal → refreshProfile.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LockClosedIcon } from 'react-native-heroicons/outline';
import { Colors, Typography, Spacing } from '@/theme/colors';
import { PressableScale, enterUp } from '@/components/motion';
import ScreenBackground from '@/components/ScreenBackground';
import StateSelect from '@/components/StateSelect';
import DobField from '@/components/DobField';
import { ageBracketFromDob, bracketMidpointDob } from '@shared/age';
import NeonButton from '@/components/NeonButton';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { CONTEXT_FIELDS, ContextValues, labelFor, parseIncome } from '@/components/FinancialContextForm';
import { saveFinancialContext } from '@/services/financialContext';
import { seedSnapshotFromOnboarding, buildRescoreInput, mergeSnapshot } from '@/services/financialSnapshot';
import { analyzeFinances } from '@/services/ai';
import { useAuth } from '@/context/AuthContext';
import StoryHero, { type StoryScene } from '@/components/onboarding/StoryHero';
import StoryProgress from '@/components/onboarding/StoryProgress';
import BuildProgress from '@/components/onboarding/BuildProgress';
import FormShell from '@/components/onboarding/FormShell';
import OField, { type FieldStatus } from '@/components/onboarding/OField';
import MoneyStep, { type MoneyValue } from '@/components/onboarding/MoneyStep';
import { type RangeOption } from '@/components/onboarding/RangeSheet';
import LoadingStage from '@/components/onboarding/LoadingStage';
import RevealStage from '@/components/onboarding/RevealStage';
import { monthYear } from '@/components/BrokeCard';

const STEP_COUNT = 7;
const optsFor = (key: string) => CONTEXT_FIELDS.find((f) => f.key === key)?.options ?? [];

const STORY: { hero: StoryScene; title: string; sub: string }[] = [
  { hero: 'peel', title: 'Your bank app shows balances.', sub: 'It hides the truth — what you owe, and where it’s quietly going.' },
  { hero: 'dial', title: 'We turn it into one number.', sub: 'Everything you earn, owe, and waste — distilled into a single 0–100 score.' },
  { hero: 'bloom', title: 'And we don’t sugarcoat it.', sub: 'Answer honestly and watch your real score build. Brutal, but yours.' },
];

// ── Money step range options (canonical brackets → display labels). "None" reads as a typed $0. ──
const NONE_OPT: RangeOption = { label: 'None', value: 'none' };
const optsFrom = (keys: string[]): RangeOption[] => keys.map((b) => ({ label: labelFor(b), value: b }));
const INCOME_OPTS: RangeOption[] = [NONE_OPT, ...optsFrom(['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k'])];
const EXPENSE_OPTS: RangeOption[] = optsFrom(['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k']);
const DEBT_OPTS: RangeOption[] = [NONE_OPT, ...optsFrom(['under_5k', '5k_15k', '15k_50k', 'over_50k'])];
const SAVINGS_OPTS: RangeOption[] = [NONE_OPT, ...optsFrom(['under_500', '500_2k', '2k_10k', '10k_50k', 'over_50k'])];

// Expenses has no financial_context bracket column — a range pick lands in the snapshot as an
// estimated midpoint (mirrors INCOME_MID); a typed exact lands as `stated` (see persist()).
const EXPENSES_MID: Record<string, number> = { under_2k: 1500, '2k_4k': 3000, '4k_6k': 5000, '6k_10k': 8000, over_10k: 12000 };

// Exact $ → bracket key (for financial_context, when the user typed instead of picking a range).
const toExact = (s: string): number | undefined => { const n = parseFloat(s); return s !== '' && Number.isFinite(n) ? n : undefined; };
const incomeBracketFor = (n: number) => (n < 2000 ? 'under_2k' : n < 4000 ? '2k_4k' : n < 6000 ? '4k_6k' : n < 10000 ? '6k_10k' : 'over_10k');
const debtBracketFor = (n: number) => (n <= 0 ? 'none' : n < 5000 ? 'under_5k' : n < 15000 ? '5k_15k' : n < 50000 ? '15k_50k' : 'over_50k');
const savingsBracketFor = (n: number) => (n <= 0 ? 'none' : n < 500 ? 'under_500' : n < 2000 ? '500_2k' : n < 10000 ? '2k_10k' : n < 50000 ? '10k_50k' : 'over_50k');

const moneyHas = (m: MoneyValue) => (m.exact !== '' && m.exact !== '.') || m.range !== null;
const EMPTY_MONEY: MoneyValue = { exact: '', range: null };

// Reveal snapshot cell text: the picked range label, or the typed exact as currency.
function moneyLabel(m: MoneyValue, opts: RangeOption[]): string {
  if (m.range) return opts.find((o) => o.value === m.range)?.label ?? '—';
  if (m.exact === '') return '—';
  const n = parseFloat(m.exact);
  return Number.isFinite(n) ? `$${n.toLocaleString('en-US')}` : '—';
}

// Cycled while the real score computes — keeps the personality going (no dead spinner).
const CALC_MESSAGES = [
  "Doing the math you've been avoiding…",
  'Tallying the damage…',
  'Consulting the financial gods…',
  'Crunching your real score…',
];

function reactionFor(score: number): string {
  const label = getScoreBand(score).label;
  if (label === 'Cooked') return "Oof. We've got work to do.";
  if (label === 'Surviving') return "Middle of the pack. Let's climb.";
  if (label === 'Stable') return "Not bad — let's make it better.";
  return "Okay, show-off.";
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, supabase, refreshProfile } = useAuth();

  const [stage, setStage] = useState<'story' | 'build' | 'calculating' | 'reveal'>('story');
  const [storyStep, setStoryStep] = useState(0);
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<FieldStatus>('idle');
  const [sel, setSel] = useState<ContextValues>({});
  const [dob, setDob] = useState<Date | null>(null);
  const [income, setIncome] = useState<MoneyValue>(EMPTY_MONEY);
  const [expenses, setExpenses] = useState<MoneyValue>(EMPTY_MONEY);
  const [debt, setDebt] = useState<MoneyValue>(EMPTY_MONEY);
  const [savings, setSavings] = useState<MoneyValue>(EMPTY_MONEY);
  const [saving, setSaving] = useState(false);
  const [startScore, setStartScore] = useState<number | null>(null);

  const pick = (key: string, opt: string) => setSel((p) => ({ ...p, [key]: p[key] === opt ? '' : opt }));
  // Birthday → derive + store the age bracket (the analyze contract takes a bracket; @shared/age).
  const handleDob = (date: Date) => { setDob(date); setSel((p) => ({ ...p, ageBracket: ageBracketFromDob(date), dob: date.toISOString() })); };

  // Debounced @handle availability check (ported from UsernameField → drives the OField status).
  useEffect(() => {
    const v = username.trim();
    if (v.length < 3 || v.length > 24 || !/^[a-z0-9_]+$/.test(v)) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('is_username_available', { p_username: v });
        if (cancelled) return;
        setUsernameStatus(error ? 'idle' : data !== false ? 'available' : 'taken');
      } catch { if (!cancelled) setUsernameStatus('idle'); }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, supabase]);

  const stepValid = [
    firstName.trim().length > 0 && lastName.trim().length > 0 && usernameStatus === 'available',
    !!sel.state && !!dob,
    !!sel.livingSituation && !!sel.employmentStatus,
    moneyHas(income),
    moneyHas(expenses),
    moneyHas(debt),
    moneyHas(savings),
  ][step];

  // ── Act 1 nav (Stories-style) ──
  const nextStory = useCallback(() => setStoryStep((s) => (s + 1) % STORY.length), []);
  const prevStory = useCallback(() => setStoryStep((s) => (s - 1 + STORY.length) % STORY.length), []);

  // ── Data spine ──
  const persist = async () => {
    if (!user) return;
    const incNum = toExact(income.exact);
    const expNum = toExact(expenses.exact);
    const debtNum = toExact(debt.exact);
    const savNum = toExact(savings.exact);

    // Brackets for financial_context (range pick → that bracket; typed exact → derived bracket).
    const incomeBracket = income.range ?? (incNum != null ? incomeBracketFor(incNum) : undefined);
    const debtBracket = debt.range ?? (debtNum != null ? debtBracketFor(debtNum) : undefined);
    const liquidSavingsBracket = savings.range ?? (savNum != null ? savingsBracketFor(savNum) : undefined);

    const values: ContextValues = {
      ...sel,
      ...(incomeBracket ? { incomeBracket } : {}),
      ...(debtBracket ? { debtBracket } : {}),
      ...(liquidSavingsBracket ? { liquidSavingsBracket } : {}),
      ...(incNum != null ? { incomeExact: String(incNum) } : {}),
    };

    try {
      // Claim the @handle (availability was checked live; a rare race is recoverable via Edit Profile).
      const { data: uData } = await supabase.rpc('set_username', { p_username: username.trim().toLowerCase() });
      if (!(uData as { ok?: boolean } | null)?.ok) console.warn('[onboarding] username not claimed:', (uData as { error?: string } | null)?.error);
      await supabase.from('profiles').update({ first_name: firstName.trim(), last_name: lastName.trim(), onboarded: true }).eq('id', user.id);
      await saveFinancialContext(user.id, values);
      // income/savings exact → stated; debt exact → debts table; brackets → estimated midpoints.
      await seedSnapshotFromOnboarding(user.id, { incomeBracket, liquidSavingsBracket, debtBracket }, { income: incNum, savings: savNum, debt: debtNum, expenses: expNum });
      // Expenses range pick → estimated midpoint (patchFromOnboarding only seeds exact expenses).
      if (expNum == null && expenses.range && expenses.range in EXPENSES_MID) {
        await mergeSnapshot(user.id, { monthlyExpenses: { value: EXPENSES_MID[expenses.range], confidence: 'estimated' } }, 'onboarding');
      }
    } catch (e) {
      console.warn('[onboarding] save failed:', e);
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
      console.warn('[onboarding] starting score failed:', e);
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

  const now = new Date();
  const revealSnapshot = [
    { label: 'Income', value: moneyLabel(income, INCOME_OPTS) },
    { label: 'Debt', value: moneyLabel(debt, DEBT_OPTS) },
    { label: 'Savings', value: moneyLabel(savings, SAVINGS_OPTS) },
  ];

  return (
    <View style={styles.container}>
      <ScreenBackground variant="onboarding" />
      <View style={[styles.body, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>

        {/* ───────── ACT 1 — STORY ───────── */}
        {stage === 'story' && (
          <>
            <StoryProgress total={STORY.length} index={storyStep} duration={9000} onComplete={nextStory} />
            <View style={styles.storyArea}>
              <ReAnimated.View key={storyStep} entering={enterUp(0)} style={styles.storyInner}>
                <StoryHero scene={STORY[storyStep].hero} />
                <Text style={styles.storyTitle}>{STORY[storyStep].title}</Text>
                <Text style={styles.storySub}>{STORY[storyStep].sub}</Text>
              </ReAnimated.View>
              <Pressable style={[styles.tapZone, styles.tapLeft]} onPress={prevStory} accessibilityLabel="Previous scene" />
              <Pressable style={[styles.tapZone, styles.tapRight]} onPress={nextStory} accessibilityLabel="Next scene" />
            </View>
            <View style={styles.storyBottom}>
              <View style={styles.trustStrip}>
                <LockClosedIcon size={13} color={Colors.textSecondary} />
                <Text style={styles.trustText}>No bank login · Private & encrypted · Delete anytime</Text>
              </View>
              <NeonButton label="Build my score →" onPress={() => setStage('build')} />
            </View>
          </>
        )}

        {/* ───────── ACT 2 — BUILD ───────── */}
        {stage === 'build' && (
          <>
            <BuildProgress step={step + 1} total={STEP_COUNT} />
            <ReAnimated.View key={step} entering={enterUp(0)} style={styles.flex}>
              {step === 0 && (
                <FormShell headline="What do we call you?" sub="So the roast hits personal." onBack={goBack} onNext={advance} canNext={!!stepValid}>
                  <OField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" returnKeyType="next" />
                  <OField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" returnKeyType="next" />
                  <OField label="Username" value={username} prefix="@" status={usernameStatus} autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={24}
                    onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24))} />
                  <Text style={styles.fieldNote}>
                    {usernameStatus === 'taken' ? 'That handle’s taken — try another.' : 'Your public @handle — other members see it when you share a roast.'}
                  </Text>
                </FormShell>
              )}
              {step === 1 && (
                <FormShell headline={firstName.trim() ? `Where you at, ${firstName.trim()}?` : 'Where you at?'} sub="Tunes your score to your actual life — not some average." onBack={goBack} onNext={advance} canNext={!!stepValid}>
                  <StateSelect value={sel.state ?? ''} onChange={(c) => pick('state', c)} />
                  <DobField value={dob} onChange={handleDob} defaultDate={bracketMidpointDob(sel.ageBracket)} placeholder="Select your birthday" />
                </FormShell>
              )}
              {step === 2 && (
                <FormShell headline="Your setup" sub="Rent, mortgage, or mom’s basement — it all counts." onBack={goBack} onNext={advance} canNext={!!stepValid}>
                  <ChipGroup label="Housing" fieldKey="livingSituation" sel={sel} pick={pick} />
                  <ChipGroup label="Employment" fieldKey="employmentStatus" sel={sel} pick={pick} />
                </FormShell>
              )}
              {step === 3 && (
                <MoneyStep headline="The money in" sub="Your monthly income — ballpark’s fine, exact if you’re feeling brave." sheetTitle="Roughly how much comes in each month?"
                  options={INCOME_OPTS} value={income} onChange={setIncome} onBack={goBack} onNext={advance} />
              )}
              {step === 4 && (
                <MoneyStep headline="The money out" sub="What you spend in a month — rent, food, the works. Ballpark’s fine, exact if you’re feeling brave." sheetTitle="Roughly how much goes out each month?"
                  options={EXPENSE_OPTS} value={expenses} onChange={setExpenses} onBack={goBack} onNext={advance} />
              )}
              {step === 5 && (
                <MoneyStep headline="What’s the damage?" sub="Combine all your credit cards, loans, and bad decisions into one number." sheetTitle="Roughly how much do you owe?"
                  options={DEBT_OPTS} value={debt} onChange={setDebt} onBack={goBack} onNext={advance} />
              )}
              {step === 6 && (
                <MoneyStep headline="The cushion" sub="Liquid savings — cash you could reach tomorrow. Not retirement or investments." sheetTitle="Roughly how much have you got saved?"
                  options={SAVINGS_OPTS} value={savings} onChange={setSavings} onBack={goBack} onNext={advance} />
              )}
            </ReAnimated.View>
          </>
        )}

        {/* ───────── ACT 3 — CALCULATING ───────── */}
        {stage === 'calculating' && <LoadingStage messages={CALC_MESSAGES} />}

        {/* ───────── ACT 3 — REVEAL ───────── */}
        {stage === 'reveal' && startScore != null && (
          <RevealStage
            score={startScore}
            reaction={reactionFor(startScore)}
            name={firstName.trim() || lastName.trim()}
            dateStr={monthYear({ month: now.getMonth(), year: now.getFullYear() })}
            snapshot={revealSnapshot}
            onSeeRoast={exitToApp}
          />
        )}
      </View>
    </View>
  );
}

// ── small presentational helpers ──
function ChipGroup({ label, fieldKey, sel, pick }: { label: string; fieldKey: string; sel: ContextValues; pick: (k: string, o: string) => void }) {
  return (
    <View style={styles.chipBlock}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chipGroup}>
        {optsFor(fieldKey).map((opt) => {
          const active = sel[fieldKey] === opt;
          return (
            <PressableScale key={opt} onPress={() => pick(fieldKey, opt)} style={[styles.chip, active && styles.chipSel]}>
              <Text style={[styles.chipText, active && styles.chipTextSel]}>{labelFor(opt)}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.xl },
  flex: { flex: 1 },
  // Story (Act 1)
  storyArea: { flex: 1, justifyContent: 'center', marginTop: Spacing.lg },
  storyInner: { alignItems: 'center', gap: Spacing.lg },
  tapZone: { position: 'absolute', top: 0, bottom: 0 },
  tapLeft: { left: 0, width: '33%' },
  tapRight: { right: 0, width: '67%' },
  storyTitle: { fontFamily: Typography.fonts.extrabold, fontSize: 38, color: Colors.textPrimary, textAlign: 'center', letterSpacing: -1.6, lineHeight: 38, marginTop: Spacing.lg },
  storySub: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.md, maxWidth: 312 },
  storyBottom: { paddingTop: Spacing.sm },
  trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: Spacing.lg },
  trustText: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, color: 'rgba(255,255,255,0.42)', letterSpacing: -0.1 },
  // Build (Act 2)
  fieldNote: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textTertiary, lineHeight: 17, marginTop: 11, marginHorizontal: 4 },
  chipBlock: { marginBottom: 28 },
  chipLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 12, color: Colors.textTertiary, letterSpacing: 0.2, marginBottom: 13, marginHorizontal: 2 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { height: 50, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.glassBorder },
  chipSel: { backgroundColor: 'rgba(255,0,122,0.12)', borderColor: Colors.accentSolid },
  chipText: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, letterSpacing: -0.2, color: Colors.textPrimary },
  chipTextSel: { color: Colors.accentSolid },
});
