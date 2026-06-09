import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, LayoutAnimation, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import SectionLabel from '@/components/SectionLabel';
import { ChevronDownIcon, ChevronUpIcon } from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ActionStep } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import NeonButton from '@/components/NeonButton';
import AnimatedProgressRing from '@/components/AnimatedProgressRing';
import LoadingState from '@/components/LoadingState';
import Disclaimer from '@/components/Disclaimer';
import { useRequireEntitlement } from '@/hooks/useRequireEntitlement';
import { useAuth } from '@/context/AuthContext';
import {
  getActivePlan, startPlan, setStepStatus, abandonPlan, reviseActivePlan, shouldRevisePlan, planProgress, planDelta,
  type ActivePlan, type PlanStartMetrics,
} from '@/services/activePlan';
import { getSnapshot } from '@/services/financialSnapshot';
import { formatCurrency } from '@/utils/format';
import { trackActionPlanViewed } from '@/services/analytics';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ActionPlan'>;
  route: RouteProp<RootStackParamList, 'ActionPlan'>;
};

const DEFAULT_STEPS: ActionStep[] = [
  { week: '1', title: 'Emergency Fund Start', description: 'Open a high-yield savings account and automate $25/week transfers.', impact: 'Builds safety net', category: 'savings', confidence: 'medium' },
  { week: '2', title: 'Subscription Purge', description: 'Cancel all subscriptions you haven\'t used in the last 30 days. No mercy.', impact: 'Saves $80–200/mo', category: 'savings', confidence: 'high' },
  { week: '3', title: 'Meal Prep Sunday', description: 'Prep 5 weekday lunches each Sunday to cut eating-out spend by 60%.', impact: 'Saves $120–180/mo', category: 'savings', confidence: 'high' },
  { week: '4', title: 'Automate Savings', description: 'Set up a recurring transfer on payday so savings happen before you can spend.', impact: 'Increases savings rate', category: 'savings', confidence: 'high' },
  { week: '5', title: 'Credit Card Minimum+', description: 'Pay minimums on all cards, plus $50 extra on the highest-rate card.', impact: 'Reduces interest paid', category: 'debt', confidence: 'medium' },
  { week: '6', title: 'Side Income Session', description: 'Dedicate 4 hours this week to one income-generating activity.', impact: '+$50–200 this week', category: 'income', confidence: 'medium' },
  { week: '7', title: 'Negotiate Bills', description: 'Call your internet, phone, and insurance providers and ask for a better rate.', impact: 'Saves $30–80/mo', category: 'savings', confidence: 'medium' },
  { week: '8', title: '30-Day Review', description: 'Run a new analysis and compare to your starting score. Celebrate progress.', impact: 'Accountability boost', category: 'mindset', confidence: 'high' },
];

// Category → the color of its slim left stripe (replaces the old exposed text chips).
function generatePersonalizedSteps(analysis: any): ActionStep[] {
  const steps: ActionStep[] = [];
  let weekNum = 1;

  if (analysis.emergencyFundMonths < 3) {
    steps.push({
      week: String(weekNum++),
      title: 'Build Emergency Fund',
      description: `You have ${analysis.emergencyFundMonths.toFixed(1)} months of emergency fund. Aim for at least 3 months. Start by setting aside $50/week.`,
      impact: 'Increases financial safety net',
      category: 'savings',
      confidence: 'high',
    });
  }

  if (analysis.savingsRate < 0.10) {
    steps.push({
      week: String(weekNum++),
      title: 'Boost Savings Rate',
      description: `Your savings rate is ${(analysis.savingsRate * 100).toFixed(0)}%. Try to get to at least 10% by cutting discretionary spending.`,
      impact: `Could save ~$${Math.round(analysis.monthlyIncome * 0.1 - analysis.monthlySavings)}/mo`,
      category: 'savings',
      confidence: 'medium',
    });
  }

  if (analysis.debtTotal > 0) {
    const debts = analysis.debts ?? [];
    const highestRateDebt = debts.length > 0 ? [...debts].sort((a: any, b: any) => b.interestRate - a.interestRate)[0] : null;
    steps.push({
      week: String(weekNum++),
      title: 'Attack Highest-Interest Debt',
      description: highestRateDebt
        ? `Focus on ${highestRateDebt.name} at ${(highestRateDebt.interestRate * 100).toFixed(1)}% APR. Pay minimums on everything else, then put extra toward this.`
        : 'Focus on your highest-interest debt first. Pay minimums on everything else.',
      impact: 'Reduces total interest paid',
      category: 'debt',
      confidence: 'high',
    });
  }

  steps.push({
    week: String(weekNum++),
    title: 'Automate Your Finances',
    description: 'Set up automatic transfers for savings, bill payments, and debt payments. Remove the friction.',
    impact: 'Prevents missed payments and builds habits',
    category: 'mindset',
    confidence: 'high',
  });

  steps.push({
    week: String(weekNum++),
    title: 'Monthly Check-In',
    description: 'Run a new analysis in 30 days and compare your score. Track your progress.',
    impact: 'Accountability and motivation',
    category: 'mindset',
    confidence: 'medium',
  });

  return steps;
}

// Expanded plan card. The payoff (→ impact) stays visible — it's the hook — while the longer
// how-to description tucks behind a chevron disclosure with a smooth height animation. Tap
// anywhere on the content to expand/collapse.
function FocalCard({ step, isActive, onDone }: {
  step: { week: string; title: string; description: string; impact: string };
  isActive: boolean;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };
  // Marking done shows a confirmation beat first (haptic + "done!"), THEN collapses to Done — so
  // the completion is seen to register before the card slides away.
  const markDone = () => {
    if (justDone) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setJustDone(true);
    setTimeout(onDone, 650);
  };
  return (
    <GlassCard style={styles.focalCard}>
      <TouchableOpacity activeOpacity={0.85} onPress={toggleExpand} disabled={justDone}>
        <View style={styles.focalTop}>
          <View style={styles.weekBadge}><Text style={styles.weekText}>{step.week}</Text></View>
        </View>
        <Text style={styles.focalTitle}>{step.title}</Text>
        <Text style={styles.focalImpact}>→ {step.impact}</Text>
        {expanded && <Text style={styles.focalDesc}>{step.description}</Text>}
        <View style={styles.discloseRow}>
          {expanded
            ? <ChevronUpIcon size={18} color={Colors.textSecondary} />
            : <ChevronDownIcon size={18} color={Colors.textSecondary} />}
        </View>
      </TouchableOpacity>
      {isActive && (justDone ? (
        <View style={styles.focalDoneRow}><Text style={styles.focalDoneText}>✓ Nice — done!</Text></View>
      ) : (
        <NeonButton label="Mark this done" onPress={markDone} style={{ marginTop: Spacing.sm }} />
      ))}
    </GlassCard>
  );
}

export default function ActionPlanScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const analysis = (route.params as any)?.analysis;
  const analysisId = (route.params as any)?.analysisId as string | undefined;
  const overallMessage = route.params?.overallMessage;
  const { authorized } = useRequireEntitlement('action_plan');
  const { animatedStyle } = useEntryAnimation();

  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [latest, setLatest] = useState<{ debt: number | null; savings: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false); // create OR refresh in progress → full-screen loading view
  const [selectedId, setSelectedId] = useState<string | null>(null); // step shown in the focal card

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    // Staleness/delta compare against the unified snapshot (Phase 2a) — the current
    // financial state (latest roast now; check-ins once 2b writes them) — not just the
    // latest check-in.
    const [p, snap] = await Promise.all([getActivePlan(user.id), getSnapshot(user.id)]);
    setPlan(p);
    setLatest(snap ? { debt: snap.debtTotal, savings: snap.liquidSavings?.value ?? null } : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    trackActionPlanViewed(0);
  }, []);

  // Create → generate the plan (LLM, behind the loading view) and immediately start tracking it.
  // Generation is user-triggered here (not on the Tools tap) so opening the screen is instant.
  const create = async () => {
    if (!user || generating) return;
    setGenerating(true);
    try {
      const { fetchOrGenerateActionPlan } = await import('@/services/ai');
      const gen = analysis ? await fetchOrGenerateActionPlan(analysis, 'savage', analysisId) : null;
      const steps = (gen?.steps && gen.steps.length > 0)
        ? gen.steps
        : (analysis ? generatePersonalizedSteps(analysis) : DEFAULT_STEPS);
      const p = await startPlan(user.id, analysisId ?? null, analysis ?? {}, steps, gen?.overallMessage ?? overallMessage);
      if (p) setPlan(p);
      else Alert.alert('Couldn\'t create plan', 'Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toggle = async (stepId: string, currentlyDone: boolean) => {
    if (!plan) return;
    const updated = await setStepStatus(plan, stepId, currentlyDone ? 'pending' : 'done');
    if (!updated) return;
    // Animate the reflow (the step sliding to/from Done) so it never snaps. The focal card runs
    // its own "done" confirmation beat before calling this, so the check is seen before the move.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPlan(updated);
  };

  // Smoothly animate the focal-card swap when a different step is selected.
  const select = (stepId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedId(stepId);
  };

  const restart = () => {
    if (!plan) return;
    Alert.alert('Restart plan?', 'This clears your current 90-day plan. You can start a fresh one from your latest roast.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: async () => { await abandonPlan(plan.id); setPlan(null); } },
    ]);
  };

  // Refresh = revise the active plan to the latest numbers (keeps completed steps). Shows the
  // shared "building" loading view; the revision is gated by materiality upstream (canUpdate).
  const refresh = async () => {
    if (!plan || generating) return;
    setGenerating(true);
    try {
      const start = plan.start_metrics;
      const snap: PlanStartMetrics = {
        debtTotal: latest?.debt ?? start?.debtTotal ?? 0,
        liquidSavings: latest?.savings ?? start?.liquidSavings ?? 0,
        monthlyIncome: start?.monthlyIncome ?? 0,
        monthlySavings: start?.monthlySavings ?? 0,
        score: start?.score ?? 0,
      };
      const res = await reviseActivePlan(plan, 'Refreshing to my latest numbers.', snap, 'savage');
      if (res.revised) setPlan(res.plan);
      else Alert.alert('Plan unchanged', res.reason);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!authorized) return null;
  if (generating) {
    // Shared loading view for Create + Refresh — never blocks the Tools tap, always lands here.
    return (
      <Animated.View style={[styles.container, animatedStyle]}>
        <ScreenBackground variant="actionPlan" />
        <View style={styles.buildingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.buildingTitle}>Building your plan…</Text>
          <Text style={styles.buildingSub}>Turning your numbers into a 90-day game plan.</Text>
        </View>
      </Animated.View>
    );
  }

  const isActive = !!plan;
  const rows = plan?.steps ?? [];
  const firstPendingIndex = rows.findIndex((s) => s.status !== 'done');
  const prog = plan ? planProgress(plan) : null;
  const delta = plan ? planDelta(plan.start_metrics, latest) : null;
  const bigPicture = plan?.overall_message;

  // Coach layout: one focal step + the rest split into up-next / done.
  const currentStep = firstPendingIndex >= 0 ? rows[firstPendingIndex] : null;
  // The focal card shows the SELECTED step (default = current); falls back to current if
  // the selection was completed or no longer exists (so it self-resets after completion).
  const focalStep = rows.find((s) => s.id === selectedId && s.status !== 'done') ?? currentStep;
  const focalIsCurrent = !!focalStep && focalStep.id === currentStep?.id;
  // Up Next = remaining pending steps, excluding BOTH the current step (it owns "This Week") and
  // the focal step (it owns "This Week" or "Coming Up") — so picking a future card never demotes
  // the current week into Up Next.
  const upNext = rows.filter((s) => s.status !== 'done' && s.id !== focalStep?.id && s.id !== currentStep?.id);
  const doneSteps = rows.filter((s) => s.status === 'done');

  // Contextual revise: only surface the update affordance when the latest check-in is a
  // material change (the deterministic gate) — not as a permanent CTA.
  const snap: PlanStartMetrics | null = plan ? {
    debtTotal: latest?.debt ?? plan.start_metrics?.debtTotal ?? 0,
    liquidSavings: latest?.savings ?? plan.start_metrics?.liquidSavings ?? 0,
    monthlyIncome: plan.start_metrics?.monthlyIncome ?? 0,
    monthlySavings: plan.start_metrics?.monthlySavings ?? 0,
    score: plan.start_metrics?.score ?? 0,
  } : null;
  const canUpdate = !!plan && !!snap && shouldRevisePlan(plan, snap).revise;

  // Expanded focal card (This Week current, or the selected future step). Keyed by step.id so the
  // Read-more state resets when the focal step changes.
  const renderFocal = (step: (typeof rows)[number]) => (
    <FocalCard key={step.id} step={step} isActive={isActive} onDone={() => toggle(step.id, false)} />
  );

  // Minimized step row (collapsed This Week + Up Next): tap ○ to complete, tap the row to focus it.
  const renderCompact = (step: (typeof rows)[number]) => (
    <View key={step.id} style={styles.compactRow}>
      <TouchableOpacity
        onPress={() => isActive && toggle(step.id, false)} disabled={!isActive}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 6 }} activeOpacity={0.6}
      >
        <View style={styles.openCircle} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.compactTextHit} onPress={() => select(step.id)} activeOpacity={0.7}>
        <Text style={styles.compactTitle} numberOfLines={1}>{step.title}</Text>
      </TouchableOpacity>
      <Text style={styles.compactWeek}>{step.week}</Text>
    </View>
  );

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="actionPlan" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {isActive ? (
          /* Active plan — score-linked hero (the app's North Star + plan completion). */
          <View style={styles.heroBlock}>
            <View style={styles.heroRow}>
              <AnimatedProgressRing pct={prog!.pct} size={92} stroke={9} />
              <View style={styles.heroMeta}>
                <Text style={styles.heroDay}>
                  Day {Math.min(prog!.daysIn + 1, plan!.horizon_days)}<Text style={styles.heroDayTotal}> of {plan!.horizon_days}</Text>
                </Text>
                <Text style={styles.heroDone}>{prog!.done} of {prog!.total} steps done</Text>
                <Text style={styles.heroNudge}>Finish the plan, watch your score climb.</Text>
              </View>
            </View>
            {(delta!.debtPaidDown > 0 || delta!.savingsGained > 0) && (
              <Text style={styles.heroDelta} numberOfLines={1}>
                {delta!.debtPaidDown > 0 ? `↓ ${formatCurrency(delta!.debtPaidDown)} debt` : ''}
                {delta!.debtPaidDown > 0 && delta!.savingsGained > 0 ? '   ·   ' : ''}
                {delta!.savingsGained > 0 ? `↑ ${formatCurrency(delta!.savingsGained)} saved` : ''}
              </Text>
            )}
          </View>
        ) : (
          /* No plan yet → create one. Generation runs on tap (with the loading view), so opening
             this screen is instant and the user explicitly starts their plan. */
          <GlassCard style={styles.progressCard}>
            <Text style={styles.progressTitle}>Your 90-day action plan</Text>
            <Text style={styles.progressSub}>A personalized, step-by-step plan to move your score — tracked the moment you create it.</Text>
            <NeonButton label="Create my plan" onPress={create} style={{ marginTop: Spacing.md }} />
          </GlassCard>
        )}

        {/* Status — visible up top so staleness is obvious before scrolling. */}
        {isActive && (canUpdate ? (
          <View style={styles.statusStale}>
            <Text style={styles.statusStaleTitle}>Your plan may be out of date</Text>
            <Text style={styles.statusStaleSub}>Your numbers changed since you started it. Refreshing keeps the steps you've completed.</Text>
            <NeonButton label="Refresh Plan" onPress={refresh} style={{ marginTop: Spacing.sm }} />
          </View>
        ) : (
          <View style={styles.statusFresh}>
            <Text style={styles.statusFreshCheck}>✓</Text>
            <Text style={styles.statusFreshText}>Your plan is up to date</Text>
          </View>
        ))}

        {/* Plan contents only exist once the plan is committed. Pre-commit = just the
            "Start this plan" action above. */}
        {isActive && bigPicture && (
          <GlassCard style={styles.overallMessageCard}>
            <Text style={styles.overallLabel}>The Big Picture</Text>
            <Text style={styles.overallText}>{bigPicture}</Text>
          </GlassCard>
        )}

        {isActive && (
          <>
            {/* This Week — always the current step: expanded when it's the focal, else minimized. */}
            <SectionLabel>This Week</SectionLabel>
            {currentStep ? (
              focalIsCurrent ? renderFocal(currentStep) : (
                <View style={styles.block}>{renderCompact(currentStep)}</View>
              )
            ) : (
              <GlassCard style={styles.focalCard}>
                <Text style={styles.focalTitle}>All steps done 🎉</Text>
                <Text style={styles.focalDesc}>You ran the whole 90-day plan. Re-roast to see how far your score moved.</Text>
              </GlassCard>
            )}

            {/* Up Next — the future steps in one section. The one you tap expands in place at the
                top; the rest stay minimized. (No separate "Coming Up" — it was redundant.) */}
            {(upNext.length > 0 || (!focalIsCurrent && !!focalStep)) && (
              <View style={styles.block}>
                <SectionLabel>Up Next</SectionLabel>
                {!focalIsCurrent && focalStep && renderFocal(focalStep)}
                {upNext.map(renderCompact)}
              </View>
            )}
          </>
        )}

        {doneSteps.length > 0 && (
          <View style={styles.block}>
            <SectionLabel>Done</SectionLabel>
            {doneSteps.map((step) => (
              <TouchableOpacity
                key={step.id} style={styles.compactRow}
                onPress={isActive ? () => toggle(step.id, true) : undefined}
                activeOpacity={isActive ? 0.7 : 1} disabled={!isActive}
              >
                <View style={styles.compactCheck}><Text style={styles.compactCheckMark}>✓</Text></View>
                <Text style={[styles.compactTitle, styles.compactTitleDone]} numberOfLines={1}>{step.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isActive && (
          <TouchableOpacity onPress={restart} activeOpacity={0.7}>
            <Text style={styles.restartLink}>Restart plan</Text>
          </TouchableOpacity>
        )}

        <Disclaimer style={styles.disclaimer} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  // Vertical rhythm standard: every top-level block gets marginBottom `block` (Spacing.xl);
  // SectionLabel owns its own marginBottom (sm) so labels hug their content. marginBottom
  // only — never marginTop — so gaps never compound.
  block: { marginBottom: Spacing.xl },
  // "Create my plan" card (no active plan)
  progressCard: { padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm },
  // Shared "Building your plan…" loading view (Create + Refresh)
  buildingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  buildingTitle: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm },
  buildingSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  progressTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  progressSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },

  // Hero — score-linked (score ring + plan-% arc)
  heroBlock: { marginBottom: Spacing.xl, gap: Spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  heroMeta: { flex: 1, gap: 4 },
  heroDay: { fontFamily: Typography.fonts.heading, fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  heroDayTotal: { fontFamily: Typography.fonts.body, fontSize: Typography.title3.fontSize, fontWeight: '400', color: Colors.textMuted },
  heroDone: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  heroNudge: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  heroDelta: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.accent },

  // Focal "this week" card
  focalCard: { padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.xs },
  focalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  focalTitle: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textPrimary },
  focalImpact: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.accent, marginTop: Spacing.sm },
  focalDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.sm },
  discloseRow: { alignItems: 'center', marginTop: Spacing.sm },
  focalDoneRow: { marginTop: Spacing.md, alignItems: 'center', paddingVertical: Spacing.sm },
  focalDoneText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.success },

  // Compact up-next / done rows. Up Next: tap the ○ to complete, tap the row to view.
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 },
  openCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.accent, backgroundColor: 'transparent' },
  compactTextHit: { flex: 1 },
  compactCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.accentSolid, alignItems: 'center', justifyContent: 'center' },
  compactCheckMark: { fontSize: 10, color: Colors.onAccent, fontWeight: '700' },
  compactTitle: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  compactTitleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  compactWeek: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted },

  // Two-state status (top)
  statusFresh: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  statusFreshCheck: { fontSize: Typography.footnote.fontSize, color: Colors.success, fontWeight: '700' },
  statusFreshText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },

  weekBadge: { backgroundColor: Colors.accentContainer, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 5, minWidth: 34, alignItems: 'center', alignSelf: 'flex-start' },
  weekText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.accent },
  statusStale: { backgroundColor: Colors.accentContainer, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.xs },
  statusStaleTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.accent },
  statusStaleSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  restartLink: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.xl },
  disclaimer: { marginTop: 0 },
  overallMessageCard: { padding: Spacing.lg, marginBottom: Spacing.xl },
  overallLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  overallText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 19, fontStyle: 'italic' },
});
