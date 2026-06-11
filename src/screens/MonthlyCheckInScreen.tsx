import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp } from '@/components/motion';
import SectionLabel from '@/components/SectionLabel';
import AppTextInput from '@/components/AppTextInput';
import { sanitizeDecimal, formatDecimal } from '@/components/DecimalInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList, CheckinConfig, TrackedGoal, CheckIn, EMPTY_CHECKIN_CONFIG, MetricKey, RoastTone } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import GlassCard from '@/components/GlassCard';
import ScreenBackground from '@/components/ScreenBackground';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getCheckinConfig, saveCheckinConfig, getCheckIns, saveCheckIn } from '@/services/checkins';
import { mergeSnapshot, updateSnapshotDebts, getSnapshot } from '@/services/financialSnapshot';
import type { FinancialSnapshot } from '@shared/financialSnapshot';
import type { SnapshotPatch } from '@shared/financialSnapshot';
import { checkinReflection } from '@/services/ai';
import { currentStreak, daysUntilNextCheckin } from '@shared/checkinCadence';
import { getAnalysisHistory, getAnalysisById } from '@/services/analyses';
import { getProfile } from '@/services/profile';
import { nextReminderDate } from '@/utils/checkinSchedule';
import { getCheckinReminderEnabled, scheduleCheckinReminder } from '@/services/notifications';
import {
  goalCandidatesFromAnalysis, computeGoalCurrent, goalProgress, formatGoalValue,
  TRACKABLE_METRICS, SUGGESTED_METRICS, metricGoalId, CheckinBase,
} from '@/utils/checkinGoals';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MonthlyCheckIn'>;
type Props = { navigation: Nav; route: RouteProp<RootStackParamList, 'MonthlyCheckIn'> };

type Mode = 'loading' | 'no-analysis' | 'setup' | 'checkin' | 'saved';

const MOODS = ['😭', '😟', '😐', '🙂', '🤑'];
const MOOD_LABELS = ['Financially Stressed', 'Worried', 'Getting By', 'Feeling Good', 'On Fire 🔥'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const num = (s: string) => {
  const n = parseFloat((s || '').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};
// Targets display in human units (percent shown as 20, stored as 0.20).
const targetToDisplay = (g: TrackedGoal) => (g.target == null ? '' : g.unit === 'percent' ? `${Math.round(g.target * 100)}` : `${g.target}`);
const displayToTarget = (unit: TrackedGoal['unit'], s: string): number | null => {
  if (!s.trim()) return null;
  const n = num(s);
  return unit === 'percent' ? n / 100 : n;
};

export default function MonthlyCheckInScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hasAccess } = useSubscription();

  const [mode, setMode] = useState<Mode>('loading');
  const [config, setConfig] = useState<CheckinConfig>(EMPTY_CHECKIN_CONFIG);
  const [firstAnalyzeAt, setFirstAnalyzeAt] = useState<string | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null);
  const [candidates, setCandidates] = useState<TrackedGoal[]>([]);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);

  // setup state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});

  // check-in state — base figures + per-debt balances, then mood/note
  const [base, setBase] = useState<Record<string, string>>({});
  const [debtInputs, setDebtInputs] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // reframe state — the full check-in series (for the streak), the user's roast voice, and the
  // post-submit reward (delta recap + the Haiku reflection).
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [roastTone, setRoastTone] = useState<RoastTone>('savage');
  const [reflection, setReflection] = useState<string | null>(null);
  const [deltaText, setDeltaText] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) { setMode('no-analysis'); return; }
      const [cfg, checkins, history, profile, snap] = await Promise.all([
        getCheckinConfig(user.id), getCheckIns(user.id), getAnalysisHistory(user.id), getProfile(user.id), getSnapshot(user.id),
      ]);
      setSnapshot(snap);
      // The reflection matches the user's chosen roast voice (profiles.preferred_tone; default savage).
      setRoastTone((profile?.preferred_tone as RoastTone) ?? 'savage');
      // Retire the generic total-debt metric goal — debt is tracked per-debt now (kind: 'debt').
      cfg.goals = cfg.goals.filter((g) => g.key !== 'debtTotal');
      setConfig(cfg);
      setLastCheckIn(checkins[0] ?? null);
      setCheckins(checkins);

      // Candidates come from the latest analysis; anchor from the earliest.
      let anchor = cfg.firstAnalyzeAt;
      if (history.length > 0) {
        if (!anchor) anchor = history[history.length - 1].created_at;
        const latest = await getAnalysisById(history[0].id);
        if (latest) setCandidates(goalCandidatesFromAnalysis(latest, { analysisId: history[0].id }));
      }
      setFirstAnalyzeAt(anchor);

      if (history.length === 0 && cfg.goals.length === 0) { setMode('no-analysis'); return; }

      const wantSetup = !!route.params?.setup || cfg.goals.length === 0;
      if (wantSetup) {
        const sel = new Set<string>(cfg.goals.map((g) => g.id));
        if (cfg.goals.length === 0) SUGGESTED_METRICS.forEach((k) => sel.add(metricGoalId(k)));
        setSelectedIds(sel);
        setMode('setup');
      } else {
        seedCheckin(cfg, checkins[0] ?? null, snap);
        setMode('checkin');
      }
    })();
  }, [user]);

  // ─── setup ───
  const candidatePool = candidates.filter((c) => c.kind === 'debt' || TRACKABLE_METRICS.includes(c.key as MetricKey));
  // Merge existing pinned goals that aren't in the candidate pool (e.g. a debt gone from the latest analysis).
  const pool: TrackedGoal[] = [...candidatePool];
  config.goals.forEach((g) => { if (!pool.some((p) => p.id === g.id)) pool.push(g); });

  const toggleGoal = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const saveSetup = async () => {
    const goals: TrackedGoal[] = pool
      .filter((g) => selectedIds.has(g.id))
      .map((g) => {
        const existing = config.goals.find((e) => e.id === g.id);
        const ti = targetInputs[g.id];
        const target = ti !== undefined ? displayToTarget(g.unit, ti) : (existing ? existing.target : g.target);
        // Preserve an existing baseline; only (re)seed from candidate when newly pinned.
        return existing ? { ...existing, target } : { ...g, target };
      });
    if (goals.length === 0) { Alert.alert('Pick at least one', 'Choose at least one thing to track.'); return; }
    const anchorDate = firstAnalyzeAt ? new Date(firstAnalyzeAt) : new Date();
    const next: CheckinConfig = {
      firstAnalyzeAt: firstAnalyzeAt ?? new Date().toISOString(),
      anchorDay: anchorDate.getDate(),
      goals,
    };
    setSaving(true);
    if (user) await saveCheckinConfig(user.id, next);
    setSaving(false);
    setConfig(next);
    // If reminders are on, (re)anchor the schedule to the (possibly new) config.
    if (await getCheckinReminderEnabled()) {
      await scheduleCheckinReminder(nextReminderDate(
        next.firstAnalyzeAt ? new Date(next.firstAnalyzeAt) : null,
        lastCheckIn ? new Date(lastCheckIn.created_at) : null,
        new Date(),
      ));
    }
    seedCheckin(next, lastCheckIn, snapshot);
    setMode('checkin');
  };

  // ─── check-in ───
  function seedCheckin(cfg: CheckinConfig, last: CheckIn | null, snap: FinancialSnapshot | null) {
    const b: Record<string, string> = {};
    const d: Record<string, string> = {};
    // Default the base figures from the current snapshot (the source of truth). A prior check-in or
    // a direct goal's baseline overrides below. Without this, goals that only need DERIVED inputs
    // (savings rate, emergency fund) left income/expenses blank ($0) on the first check-in.
    const snapStr = (f?: { value: number }) => (f?.value != null && f.value > 0 ? `${Math.round(f.value)}` : '');
    b.income = snapStr(snap?.monthlyIncome);
    b.expenses = snapStr(snap?.monthlyExpenses);
    b.savings = snapStr(snap?.liquidSavings);
    const lastVal = (id: string, fallback?: number) => {
      const v = last?.metrics?.[id];
      return v != null ? `${v}` : fallback != null ? `${fallback}` : '';
    };
    // JSONB-only (schema-v2): a prior check-in's headline figures live in metrics under their MetricKey.
    const lastM = (k: MetricKey): number | null | undefined => last?.metrics?.[k];
    cfg.goals.forEach((g) => {
      if (g.kind === 'debt') { d[g.key] = lastVal(g.id, g.baseline); return; }
      switch (g.key as MetricKey) {
        case 'liquidSavings': b.savings = lastVal('liquidSavings', g.baseline); break;
        case 'debtTotal': b.totalDebt = lastVal('debtTotal', g.baseline); break;
        case 'monthlyIncome': b.income = lastVal('monthlyIncome', g.baseline); break;
        case 'monthlyExpenses': b.expenses = lastVal('monthlyExpenses', g.baseline); break;
        // derived metrics need their base inputs collected too
        case 'monthlySavings': case 'savingsRate':
          if (lastM('monthlyIncome') != null) b.income = `${lastM('monthlyIncome')}`;
          if (lastM('monthlyExpenses') != null) b.expenses = `${lastM('monthlyExpenses')}`;
          break;
        case 'emergencyFundMonths':
          if (lastM('liquidSavings') != null) b.savings = `${lastM('liquidSavings')}`;
          if (lastM('monthlyExpenses') != null) b.expenses = `${lastM('monthlyExpenses')}`;
          break;
      }
    });
    setBase(b); setDebtInputs(d); setMood(null); setNote('');
  }

  // Which base fields are needed by the pinned goals.
  const needs = (() => {
    const keys = config.goals.filter((g) => g.kind === 'metric').map((g) => g.key as MetricKey);
    return {
      income: keys.some((k) => ['monthlyIncome', 'monthlySavings', 'savingsRate'].includes(k)),
      expenses: keys.some((k) => ['monthlyExpenses', 'monthlySavings', 'savingsRate', 'emergencyFundMonths'].includes(k)),
      savings: keys.some((k) => ['liquidSavings', 'emergencyFundMonths'].includes(k)),
    };
  })();

  const currentBase = (): CheckinBase => ({
    income: num(base.income), expenses: num(base.expenses), savings: num(base.savings), totalDebt: num(base.totalDebt),
    debts: Object.fromEntries(Object.entries(debtInputs).map(([k, v]) => [k, num(v)])),
  });

  const submitCheckin = async () => {
    if (!user) return;
    const b = currentBase();
    const metrics: Record<string, number> = {};
    config.goals.forEach((g) => { metrics[g.id] = computeGoalCurrent(g, b); });

    // Delta since last check-in (from stored goal metrics) — drives the reward recap + the
    // reflection. Passed to Haiku as a pre-interpreted string so it never parses signs.
    let debtPaidDown = 0, savingsGained = 0;
    config.goals.forEach((g) => {
      const current = computeGoalCurrent(g, b);
      const prev = lastCheckIn?.metrics?.[g.id] ?? g.baseline;
      if (g.kind === 'debt') debtPaidDown += Math.max(0, prev - current);
      else if (g.key === 'liquidSavings') savingsGained += current - prev;
    });
    const dParts: string[] = [];
    if (debtPaidDown > 0) dParts.push(`paid down $${Math.round(debtPaidDown).toLocaleString()} of debt`);
    if (savingsGained > 0) dParts.push(`saved $${Math.round(savingsGained).toLocaleString()}`);
    else if (savingsGained < 0) dParts.push(`savings dipped $${Math.round(-savingsGained).toLocaleString()}`);
    const deltaStr = dParts.join(' and ') || 'held about steady';
    setDeltaText(deltaStr);

    setSaving(true);
    // The Haiku "coach's note" — matches the roast voice; non-fatal (null → no note in the reward).
    const refl = await checkinReflection({
      mood: MOOD_LABELS[mood ?? 2], note: note || undefined, delta: deltaStr, tone: roastTone,
    }).catch(() => null);
    setReflection(refl);

    const ok = await saveCheckIn(user.id, {
      mood: mood ?? 2,
      notes: note || undefined,
      income: needs.income ? b.income : undefined,
      expenses: needs.expenses ? b.expenses : undefined,
      savings: needs.savings ? b.savings : undefined,
      metrics,
      reflection: refl || undefined,
    });
    setSaving(false);
    if (ok === null) { Alert.alert('Error', 'Failed to save your check-in.'); return; }

    // Update the unified snapshot: scalars (stated) + per-debt balances by name (Chunk B). Non-fatal.
    const patch: SnapshotPatch = {};
    if (needs.income && b.income > 0) patch.monthlyIncome = { value: b.income, confidence: 'stated' };
    if (needs.expenses && b.expenses > 0) patch.monthlyExpenses = { value: b.expenses, confidence: 'stated' };
    if (needs.savings && Number.isFinite(b.savings)) patch.liquidSavings = { value: b.savings, confidence: 'stated' };
    if (patch.monthlyIncome || patch.monthlyExpenses || patch.liquidSavings) {
      mergeSnapshot(user.id, patch, 'checkin').catch((e) => console.warn('[snapshot] check-in merge failed:', e));
    }
    const debtUpdates: Record<string, number> = {};
    config.goals.filter((g) => g.kind === 'debt').forEach((g) => { debtUpdates[g.label] = num(debtInputs[g.key]); });
    if (Object.keys(debtUpdates).length > 0) {
      updateSnapshotDebts(user.id, debtUpdates).catch((e) => console.warn('[snapshot] check-in debt update failed:', e));
    }

    // Move the reminder to next month's anchor now that this period is done.
    if (await getCheckinReminderEnabled()) {
      await scheduleCheckinReminder(nextReminderDate(firstAnalyzeAt ? new Date(firstAnalyzeAt) : null, new Date(), new Date()));
    }
    setMode('saved');
  };

  const runReScore = () => {
    const b = currentBase();
    const movement = config.goals
      .map((g) => `${g.label}: ${formatGoalValue(g.unit, g.baseline)} → ${formatGoalValue(g.unit, computeGoalCurrent(g, b))}`)
      .join('; ');
    const situationText =
      `Monthly check-in update. Income $${b.income}/mo, expenses $${b.expenses}/mo, savings $${b.savings}. ` +
      `Tracked goals — ${movement}. Mood: ${mood !== null ? MOODS[mood] : 'n/a'}. Note: ${note || 'none'}.`;
    navigation.replace('Processing', { userInput: situationText });
  };

  // ─── render ───
  if (mode === 'loading') return <LoadingState style={{ flex: 1 }} />;

  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  // Soft-monthly: the streak + a nudge (never a gate — the screen is always reachable).
  const checkinDates = checkins.map((c) => c.created_at);
  const streak = currentStreak(checkinDates, now);
  const savedStreak = currentStreak([...checkinDates, now.toISOString()], now); // includes the just-saved one
  const dueText = daysUntilNextCheckin(checkinDates, now) === 0
    ? 'Check-in open' : `Next check-in in ${daysUntilNextCheckin(checkinDates, now)}d`;

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="checkin" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'no-analysis' && (
          <View style={{ paddingTop: Spacing.xxl }}>
            <EmptyState
              emoji="📈"
              title="Start with a roast"
              body="Run your first roast, then pick the numbers you want to track here every month."
            />
            <NeonButton label="Roast my finances" onPress={() => navigation.navigate('Analyze')} style={{ marginTop: Spacing.lg }} />
          </View>
        )}

        {mode === 'setup' && (
          <>
            <Text style={styles.title}>What do you want to track?</Text>
            <Text style={styles.subtitle}>
              Pick the metrics and debts you'll check in on each month. We'll remember the baseline and show your progress.
            </Text>
            <SectionLabel style={{ marginTop: Spacing.md }}>Track Monthly</SectionLabel>
            <View style={styles.formGroup}>
              {pool.map((g, i) => {
                const on = selectedIds.has(g.id);
                return (
                  <React.Fragment key={g.id}>
                    {i > 0 && <View style={styles.cellSep} />}
                    <TouchableOpacity style={styles.pickRow} onPress={() => toggleGoal(g.id)} activeOpacity={0.7}>
                      <Ionicons
                        name={on ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={on ? Colors.accent : Colors.textMuted}
                      />
                      <View style={styles.pickInfo}>
                        <Text style={styles.pickLabel}>{g.label}</Text>
                        <Text style={styles.pickBaseline}>Now: {formatGoalValue(g.unit, g.baseline)}</Text>
                      </View>
                      {on && (g.unit === 'currency' || g.unit === 'percent' || g.unit === 'months') ? (
                        <View style={styles.targetWrap}>
                          <Text style={styles.targetLabel}>Goal</Text>
                          <View style={styles.targetBox}>
                            {g.unit === 'currency' && <Text style={styles.targetUnit}>$</Text>}
                            <AppTextInput
                              style={styles.targetInput}
                              placeholder={targetToDisplay(config.goals.find((e) => e.id === g.id) ?? g) || '0'}
                              placeholderTextColor={Colors.textMuted}
                              keyboardType="decimal-pad"
                              value={targetInputs[g.id] ?? targetToDisplay(config.goals.find((e) => e.id === g.id) ?? g)}
                              onChangeText={(v) => setTargetInputs((p) => ({ ...p, [g.id]: sanitizeDecimal(v) }))}
                              onBlur={() => setTargetInputs((p) => ({ ...p, [g.id]: formatDecimal(p[g.id] ?? targetToDisplay(config.goals.find((e) => e.id === g.id) ?? g)) }))}
                            />
                            {g.unit !== 'currency' && <Text style={styles.targetUnit}>{g.unit === 'percent' ? '%' : 'mo'}</Text>}
                          </View>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
            <NeonButton label={saving ? 'Saving…' : 'Start tracking →'} onPress={saveSetup} loading={saving} />
          </>
        )}

        {mode === 'checkin' && (
          <>
            <Text style={styles.title}>{monthLabel} Check-In</Text>
            <View style={styles.headMeta}>
              {streak > 0 && <Text style={styles.streakChip}>🔥 {streak}-mo streak</Text>}
              <Text style={styles.nudge}>{dueText}</Text>
            </View>

            {/* Pulse leads — how you're feeling + an optional note. */}
            <SectionLabel style={{ marginTop: Spacing.md }}>How's money feeling this month?</SectionLabel>
            <View style={styles.moodRow}>
              {MOODS.map((m, i) => (
                <TouchableOpacity key={i} style={[styles.moodBtn, mood === i && styles.moodBtnActive]} onPress={() => setMood(i)} activeOpacity={0.7}>
                  <Text style={styles.moodEmoji}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mood !== null && <Text style={styles.moodLabel}>{MOOD_LABELS[mood]}</Text>}
            <GlassCard variant="inset" style={styles.noteCard}>
              <AppTextInput
                style={styles.noteInput}
                placeholder={'What’s on your mind about money? (optional)'}
                placeholderTextColor={Colors.textMuted}
                multiline value={note} onChangeText={setNote} textAlignVertical="top"
              />
            </GlassCard>

            {/* Refresh — update what's changed (prefilled with last month's values). */}
            <SectionLabel style={{ marginTop: Spacing.md }}>Update what's changed</SectionLabel>
            <View style={styles.formGroup}>
              {needs.income && <BaseInput label="Monthly Income" value={base.income} onChange={(v) => setBase((p) => ({ ...p, income: v }))} first />}
              {needs.expenses && <BaseInput label="Monthly Expenses" value={base.expenses} onChange={(v) => setBase((p) => ({ ...p, expenses: v }))} first={!needs.income} />}
              {needs.savings && <BaseInput label="Savings Balance" value={base.savings} onChange={(v) => setBase((p) => ({ ...p, savings: v }))} first={!needs.income && !needs.expenses} />}
              {config.goals.filter((g) => g.kind === 'debt').map((g, i) => (
                <BaseInput key={g.id} label={g.label} value={debtInputs[g.key] ?? ''} onChange={(v) => setDebtInputs((p) => ({ ...p, [g.key]: v }))} first={!needs.income && !needs.expenses && !needs.savings && i === 0} />
              ))}
            </View>

            {/* Live progress vs baseline */}
            <SectionLabel style={{ marginTop: Spacing.md }}>Your Progress</SectionLabel>
            <View style={styles.formGroup}>
              {config.goals.map((g, i) => {
                const current = computeGoalCurrent(g, currentBase());
                const p = goalProgress(g, current);
                // "No change" = the DISPLAYED values match, so 0.4 → 0.4 reads as no change even
                // when the raw delta is a rounding hair. Thick bar for no change; a bold up / down
                // arrow for a real increase / decrease. Colour = improvement (green) / regression
                // (red); muted (never red) when there's no change.
                const baseStr = formatGoalValue(g.unit, g.baseline);
                const curStr = formatGoalValue(g.unit, current);
                const noChange = baseStr === curStr;
                const color = noChange ? Colors.textMuted : p.improved ? Colors.success : Colors.danger;
                return (
                  <React.Fragment key={g.id}>
                    {i > 0 && <View style={styles.cellSep} />}
                    <View style={styles.progRow}>
                      <Text style={styles.progLabel}>{g.label}</Text>
                      <View style={styles.progValues}>
                        <Text style={styles.progBaseline}>{baseStr}</Text>
                        {noChange
                          ? <View style={[styles.noChangeBar, { backgroundColor: color }]} />
                          : <MaterialCommunityIcons name={p.delta > 0 ? 'arrow-up-bold' : 'arrow-down-bold'} size={20} color={color} />}
                        <Text style={[styles.progCurrent, { color }]}>{curStr}</Text>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>

            <NeonButton label={saving ? 'Saving…' : 'Complete check-in'} onPress={submitCheckin} loading={saving} />
            <TouchableOpacity onPress={() => { setSelectedIds(new Set(config.goals.map((g) => g.id))); setMode('setup'); }} style={styles.editLink}>
              <Text style={styles.editLinkText}>Edit what I track</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'saved' && (
          <View style={{ paddingTop: Spacing.xl }}>
            <Text style={styles.savedEmoji}>{savedStreak > 1 ? '🔥' : '✅'}</Text>
            <Text style={styles.title}>{savedStreak > 1 ? `${savedStreak}-month streak!` : 'Check-in logged'}</Text>
            <Text style={styles.subtitle}>Since last time, you {deltaText}.</Text>

            {reflection && (
              <GlassCard variant="inset" style={styles.reflectionCard}>
                <Text style={styles.reflectionText}>{reflection}</Text>
              </GlassCard>
            )}

            {/* Handoff to the plan — the snapshot's updated, so don't re-render progress here. */}
            <NeonButton label="See your updated plan" onPress={() => navigation.navigate('ActionPlan', {})} />
            {hasAccess('action_plan') ? (
              <TouchableOpacity onPress={runReScore} style={styles.editLink}>
                <Text style={styles.editLinkText}>Get a fresh AI re-score 🚀</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('Paywall')} style={styles.editLink}>
                <Text style={styles.editLinkText}>💎 Unlock an AI re-score</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.editLink}>
              <Text style={styles.editLinkText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ReAnimated.View>
  );
}

function BaseInput({ label, value, onChange, first }: { label: string; value: string; onChange: (v: string) => void; first?: boolean }) {
  return (
    <>
      {!first && <View style={styles.cellSep} />}
      <View style={styles.formCell}>
        <Text style={styles.formLabel}>{label}</Text>
        <View style={styles.formInputRow}>
          <Text style={styles.formPrefix}>$</Text>
          <AppTextInput
            style={styles.formInput}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            value={value}
            onChangeText={(t) => onChange(sanitizeDecimal(t))}
            onBlur={() => onChange(formatDecimal(value))}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  title: { fontFamily: Typography.fonts.heading, fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 22 },
  formGroup: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight, marginBottom: Spacing.lg },
  cellSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.lg },
  formCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 13, minHeight: 50 },
  formLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  formInputRow: { flexDirection: 'row', alignItems: 'center', gap: 1, backgroundColor: Colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.glassBorder, paddingHorizontal: Spacing.sm, paddingVertical: 5, minWidth: 104 },
  formPrefix: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  formInput: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, minWidth: 68, textAlign: 'left', paddingVertical: 0 },
  // setup picker
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, minHeight: 56 },
  pickInfo: { flex: 1 },
  pickLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  pickBaseline: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted, marginTop: 1 },
  targetWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  targetLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted },
  targetBox: { flexDirection: 'row', alignItems: 'center', gap: 1, backgroundColor: Colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.glassBorder, paddingHorizontal: Spacing.sm, paddingVertical: 4, minWidth: 54 },
  targetInput: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.accent, minWidth: 24, textAlign: 'left', paddingVertical: 0 },
  targetUnit: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  // progress
  progRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  progLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, flex: 1 },
  progValues: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  noChangeBar: { width: 14, height: 4, borderRadius: 2 },
  progBaseline: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textMuted },
  progCurrent: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, fontWeight: '700' },
  // mood
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  moodBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  moodBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentContainer },
  moodEmoji: { fontSize: Typography.title2.fontSize },
  moodLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.accent, textAlign: 'center', marginBottom: Spacing.md },
  noteCard: { padding: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.lg },
  noteInput: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, minHeight: 70, lineHeight: 22 },
  editLink: { alignItems: 'center', paddingVertical: Spacing.md },
  editLinkText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textDecorationLine: 'underline' },
  // header meta (streak + soft-monthly nudge)
  headMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2, marginBottom: Spacing.sm },
  streakChip: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, color: Colors.accent },
  nudge: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textMuted },
  // saved / reward
  savedEmoji: { fontSize: 44, textAlign: 'center', marginBottom: Spacing.sm },
  reflectionCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  reflectionText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, lineHeight: 22, textAlign: 'center' },
});
