import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Animated,
} from 'react-native';
import SectionLabel from '@/components/SectionLabel';
import AppTextInput from '@/components/AppTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, CheckinConfig, TrackedGoal, CheckIn, EMPTY_CHECKIN_CONFIG, MetricKey } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import GlassCard from '@/components/GlassCard';
import ScreenBackground from '@/components/ScreenBackground';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import {
  getCheckinConfig, saveCheckinConfig, getCheckIns, saveCheckIn,
  getAnalysisHistory, getAnalysisById,
} from '@/services/claudeApi';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
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
  const { animatedStyle } = useEntryAnimation();

  const [mode, setMode] = useState<Mode>('loading');
  const [config, setConfig] = useState<CheckinConfig>(EMPTY_CHECKIN_CONFIG);
  const [firstAnalyzeAt, setFirstAnalyzeAt] = useState<string | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null);
  const [candidates, setCandidates] = useState<TrackedGoal[]>([]);

  // setup state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});

  // check-in state — base figures + per-debt balances, then mood/note
  const [base, setBase] = useState<Record<string, string>>({});
  const [debtInputs, setDebtInputs] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) { setMode('no-analysis'); return; }
      const [cfg, checkins, history] = await Promise.all([
        getCheckinConfig(user.id), getCheckIns(user.id), getAnalysisHistory(user.id),
      ]);
      setConfig(cfg);
      setLastCheckIn(checkins[0] ?? null);

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
        seedCheckin(cfg, checkins[0] ?? null);
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
    seedCheckin(next, lastCheckIn);
    setMode('checkin');
  };

  // ─── check-in ───
  function seedCheckin(cfg: CheckinConfig, last: CheckIn | null) {
    const b: Record<string, string> = {};
    const d: Record<string, string> = {};
    const lastVal = (id: string, fallback?: number) => {
      const v = last?.metrics?.[id];
      return v != null ? `${v}` : fallback != null ? `${fallback}` : '';
    };
    cfg.goals.forEach((g) => {
      if (g.kind === 'debt') { d[g.key] = lastVal(g.id, g.baseline); return; }
      switch (g.key as MetricKey) {
        case 'liquidSavings': b.savings = last?.savings != null ? `${last.savings}` : `${g.baseline}`; break;
        case 'debtTotal': b.totalDebt = last?.debt != null ? `${last.debt}` : `${g.baseline}`; break;
        case 'monthlyIncome': b.income = last?.income != null ? `${last.income}` : `${g.baseline}`; break;
        case 'monthlyExpenses': b.expenses = last?.expenses != null ? `${last.expenses}` : `${g.baseline}`; break;
        // derived metrics need their base inputs collected too
        case 'monthlySavings': case 'savingsRate':
          if (last?.income != null) b.income = `${last.income}`;
          if (last?.expenses != null) b.expenses = `${last.expenses}`;
          break;
        case 'emergencyFundMonths':
          if (last?.savings != null) b.savings = `${last.savings}`;
          if (last?.expenses != null) b.expenses = `${last.expenses}`;
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
      totalDebt: keys.includes('debtTotal'),
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
    setSaving(true);
    const ok = await saveCheckIn(user.id, {
      mood: mood ?? 2,
      notes: note || undefined,
      income: needs.income ? b.income : undefined,
      expenses: needs.expenses ? b.expenses : undefined,
      savings: needs.savings ? b.savings : undefined,
      debt: needs.totalDebt ? b.totalDebt : undefined,
      metrics,
    });
    setSaving(false);
    if (ok === null) { Alert.alert('Error', 'Failed to save your check-in.'); return; }
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
      `Monthly check-in update. Income $${b.income}/mo, expenses $${b.expenses}/mo, savings $${b.savings}, total debt $${b.totalDebt}. ` +
      `Tracked goals — ${movement}. Mood: ${mood !== null ? MOODS[mood] : 'n/a'}. Note: ${note || 'none'}.`;
    navigation.replace('Processing', { userInput: situationText });
  };

  // ─── render ───
  if (mode === 'loading') return <LoadingState style={{ flex: 1 }} />;

  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
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
              title="Start with an analysis"
              body="Run your first analysis, then pick the numbers you want to track here every month."
            />
            <NeonButton label="Analyze my finances" onPress={() => navigation.navigate('Analyze')} style={{ marginTop: Spacing.lg }} />
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
                        color={on ? Colors.primary : Colors.textMuted}
                      />
                      <View style={styles.pickInfo}>
                        <Text style={styles.pickLabel}>{g.label}</Text>
                        <Text style={styles.pickBaseline}>Now: {formatGoalValue(g.unit, g.baseline)}</Text>
                      </View>
                      {on && (g.unit === 'currency' || g.unit === 'percent' || g.unit === 'months') ? (
                        <View style={styles.targetWrap}>
                          <Text style={styles.targetLabel}>Goal</Text>
                          <AppTextInput
                            style={styles.targetInput}
                            placeholder={targetToDisplay(config.goals.find((e) => e.id === g.id) ?? g) || '—'}
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                            value={targetInputs[g.id] ?? targetToDisplay(config.goals.find((e) => e.id === g.id) ?? g)}
                            onChangeText={(v) => setTargetInputs((p) => ({ ...p, [g.id]: v }))}
                          />
                          <Text style={styles.targetUnit}>{g.unit === 'percent' ? '%' : g.unit === 'months' ? 'mo' : '$'}</Text>
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
            <Text style={styles.subtitle}>Update your numbers — we'll show how you're tracking against your goals.</Text>

            <SectionLabel style={{ marginTop: Spacing.md }}>This Month's Figures</SectionLabel>
            <View style={styles.formGroup}>
              {needs.income && <BaseInput label="Monthly Income" value={base.income} onChange={(v) => setBase((p) => ({ ...p, income: v }))} first />}
              {needs.expenses && <BaseInput label="Monthly Expenses" value={base.expenses} onChange={(v) => setBase((p) => ({ ...p, expenses: v }))} first={!needs.income} />}
              {needs.savings && <BaseInput label="Savings Balance" value={base.savings} onChange={(v) => setBase((p) => ({ ...p, savings: v }))} first={!needs.income && !needs.expenses} />}
              {needs.totalDebt && <BaseInput label="Total Debt" value={base.totalDebt} onChange={(v) => setBase((p) => ({ ...p, totalDebt: v }))} first={!needs.income && !needs.expenses && !needs.savings} />}
              {config.goals.filter((g) => g.kind === 'debt').map((g, i) => (
                <BaseInput key={g.id} label={g.label} value={debtInputs[g.key] ?? ''} onChange={(v) => setDebtInputs((p) => ({ ...p, [g.key]: v }))} first={!needs.income && !needs.expenses && !needs.savings && !needs.totalDebt && i === 0} />
              ))}
            </View>

            {/* Live progress vs baseline */}
            <SectionLabel style={{ marginTop: Spacing.md }}>Your Progress</SectionLabel>
            <View style={styles.formGroup}>
              {config.goals.map((g, i) => {
                const current = computeGoalCurrent(g, currentBase());
                const p = goalProgress(g, current);
                // Arrow = actual value direction; colour = whether that's an improvement.
                const arrow = p.delta === 0 ? '→' : p.delta > 0 ? '↑' : '↓';
                const color = p.delta === 0 ? Colors.textMuted : p.improved ? Colors.success : Colors.danger;
                return (
                  <React.Fragment key={g.id}>
                    {i > 0 && <View style={styles.cellSep} />}
                    <View style={styles.progRow}>
                      <Text style={styles.progLabel}>{g.label}</Text>
                      <View style={styles.progValues}>
                        <Text style={styles.progBaseline}>{formatGoalValue(g.unit, g.baseline)}</Text>
                        <Text style={[styles.progArrow, { color }]}>{arrow}</Text>
                        <Text style={[styles.progCurrent, { color }]}>{formatGoalValue(g.unit, current)}</Text>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>

            <SectionLabel style={{ marginTop: Spacing.md }}>How are you feeling?</SectionLabel>
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
                placeholder={'Optional note — anything unusual this month?'}
                placeholderTextColor={Colors.textMuted}
                multiline value={note} onChangeText={setNote} textAlignVertical="top"
              />
            </GlassCard>

            <NeonButton label={saving ? 'Saving…' : 'Save check-in'} onPress={submitCheckin} loading={saving} />
            <TouchableOpacity onPress={() => { setSelectedIds(new Set(config.goals.map((g) => g.id))); setMode('setup'); }} style={styles.editLink}>
              <Text style={styles.editLinkText}>Edit what I track</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'saved' && (
          <View style={{ paddingTop: Spacing.xl }}>
            <Text style={styles.savedEmoji}>✅</Text>
            <Text style={styles.title}>Check-in saved</Text>
            <Text style={styles.subtitle}>Your progress is logged and your trend is updated.</Text>

            {hasAccess('action_plan') ? (
              <>
                <NeonButton label="Get your AI re-score 🚀" onPress={runReScore} />
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.editLink}>
                  <Text style={styles.editLinkText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <GlassCard style={styles.upsell}>
                  <Text style={styles.upsellTitle}>💎 Want your new score?</Text>
                  <Text style={styles.upsellBody}>Upgrade to get a fresh AI analysis that interprets your progress and updates your score.</Text>
                </GlassCard>
                <NeonButton label="See plans" onPress={() => navigation.navigate('Paywall')} />
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.editLink}>
                  <Text style={styles.editLinkText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Animated.View>
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
            onChangeText={onChange}
            keyboardType="numeric"
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
  formInputRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  formPrefix: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  formInput: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, minWidth: 80, textAlign: 'right' },
  // setup picker
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, minHeight: 56 },
  pickInfo: { flex: 1 },
  pickLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  pickBaseline: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted, marginTop: 1 },
  targetWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  targetLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted },
  targetInput: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.primary, minWidth: 38, textAlign: 'right' },
  targetUnit: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  // progress
  progRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  progLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, flex: 1 },
  progValues: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  progBaseline: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textMuted },
  progArrow: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  progCurrent: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, fontWeight: '700' },
  // mood
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  moodBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  moodBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  moodEmoji: { fontSize: Typography.title2.fontSize },
  moodLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.primary, textAlign: 'center', marginBottom: Spacing.md },
  noteCard: { padding: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.lg },
  noteInput: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, minHeight: 70, lineHeight: 22 },
  editLink: { alignItems: 'center', paddingVertical: Spacing.md },
  editLinkText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textDecorationLine: 'underline' },
  // saved
  savedEmoji: { fontSize: 44, textAlign: 'center', marginBottom: Spacing.sm },
  upsell: { padding: Spacing.lg, marginBottom: Spacing.lg },
  upsellTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.callout.fontSize, color: Colors.primary, marginBottom: Spacing.xs },
  upsellBody: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 19 },
});
