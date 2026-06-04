import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, useWindowDimensions,
} from 'react-native';
import SectionLabel from '@/components/SectionLabel';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ActionStep } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import NeonButton from '@/components/NeonButton';
import PlanTrack from '@/components/PlanTrack';
import { PressableScale } from '@/components/motion';
import LoadingState from '@/components/LoadingState';
import Disclaimer from '@/components/Disclaimer';
import { useRequireEntitlement } from '@/hooks/useRequireEntitlement';
import { useAuth } from '@/context/AuthContext';
import {
  getActivePlan, startPlan, setStepStatus, abandonPlan, reviseActivePlan, shouldRevisePlan, planProgress, planDelta,
  type ActivePlan, type PlanStartMetrics,
} from '@/services/activePlan';
import { getCheckIns } from '@/services/checkins';
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
const CATEGORY_COLOR: Record<string, string> = {
  savings: Colors.success,
  debt: Colors.danger,
  income: Colors.info,
  mindset: Colors.accentSolid,
};

function catColor(cat?: string): string {
  return (cat && CATEGORY_COLOR[cat]) || Colors.accentSolid;
}

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

export default function ActionPlanScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { user } = useAuth();
  const rawSteps = route.params?.steps;
  const analysis = (route.params as any)?.analysis;
  const analysisId = (route.params as any)?.analysisId as string | undefined;
  const overallMessage = route.params?.overallMessage;
  const { authorized } = useRequireEntitlement('action_plan');
  const { animatedStyle } = useEntryAnimation();

  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [latest, setLatest] = useState<{ debt: number | null; savings: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [revising, setRevising] = useState(false);

  // Candidate plan shown until one is committed (the generated/passed steps).
  const previewSteps: ActionStep[] = (rawSteps && rawSteps.length > 0)
    ? rawSteps
    : (analysis ? generatePersonalizedSteps(analysis) : DEFAULT_STEPS);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const [p, checkins] = await Promise.all([getActivePlan(user.id), getCheckIns(user.id)]);
    setPlan(p);
    const c = checkins?.[0];
    setLatest(c ? { debt: c.debt, savings: c.savings } : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    trackActionPlanViewed(previewSteps.length);
  }, []);

  const commit = async () => {
    if (!user || committing) return;
    setCommitting(true);
    try {
      const p = await startPlan(user.id, analysisId ?? null, analysis ?? {}, previewSteps, overallMessage);
      if (p) setPlan(p);
      else Alert.alert('Couldn\'t start plan', 'Something went wrong. Please try again.');
    } finally {
      setCommitting(false);
    }
  };

  const toggle = async (stepId: string, done: boolean) => {
    if (!plan) return;
    const updated = await setStepStatus(plan, stepId, done ? 'pending' : 'done');
    if (updated) setPlan(updated);
  };

  const restart = () => {
    if (!plan) return;
    Alert.alert('Restart plan?', 'This clears your current 90-day plan. You can start a fresh one from your latest roast.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: async () => { await abandonPlan(plan.id); setPlan(null); } },
    ]);
  };

  // Revise the active plan from the latest check-in numbers (gated by materiality).
  const update = async () => {
    if (!plan || revising) return;
    setRevising(true);
    try {
      const start = plan.start_metrics;
      const snap: PlanStartMetrics = {
        debtTotal: latest?.debt ?? start?.debtTotal ?? 0,
        liquidSavings: latest?.savings ?? start?.liquidSavings ?? 0,
        monthlyIncome: start?.monthlyIncome ?? 0,
        monthlySavings: start?.monthlySavings ?? 0,
        score: start?.score ?? 0,
      };
      const res = await reviseActivePlan(plan, 'Updating from my latest check-in.', snap, 'savage');
      if (res.revised) setPlan(res.plan);
      else Alert.alert('Plan unchanged', res.reason);
    } finally {
      setRevising(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!authorized) return null;

  const isActive = !!plan;
  // Unified row shape: active rows carry id/status; preview rows are pending + synthetic id.
  const rows = isActive
    ? plan!.steps
    : previewSteps.map((s, i) => ({ ...s, id: `p${i}`, status: 'pending' as const, completed_at: null }));
  const firstPendingIndex = rows.findIndex((s) => s.status !== 'done');
  const prog = plan ? planProgress(plan) : null;
  const delta = plan ? planDelta(plan.start_metrics, latest) : null;
  const bigPicture = isActive ? plan!.overall_message : overallMessage;

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

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="actionPlan" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {isActive ? (
          /* Active plan — the 90-day journey is the hero (full-bleed, no card). */
          <View style={styles.heroBlock}>
            <Text style={styles.heroDay}>
              Day {Math.min(prog!.daysIn + 1, plan!.horizon_days)}<Text style={styles.heroDayTotal}> of {plan!.horizon_days}</Text>
            </Text>
            <PlanTrack steps={plan!.steps} width={screenW - Spacing.xl * 2} />
            <View style={styles.heroFootRow}>
              <Text style={styles.heroDone}>{prog!.done} of {prog!.total} done</Text>
              {(delta!.debtPaidDown > 0 || delta!.savingsGained > 0) && (
                <Text style={styles.heroDelta} numberOfLines={1}>
                  {delta!.debtPaidDown > 0 ? `↓ ${formatCurrency(delta!.debtPaidDown)} debt` : ''}
                  {delta!.debtPaidDown > 0 && delta!.savingsGained > 0 ? '  ·  ' : ''}
                  {delta!.savingsGained > 0 ? `↑ ${formatCurrency(delta!.savingsGained)} saved` : ''}
                </Text>
              )}
            </View>
          </View>
        ) : (
          /* Preview — not yet committed */
          <GlassCard style={styles.progressCard}>
            <Text style={styles.progressTitle}>Your 90-day action plan</Text>
            <Text style={styles.progressSub}>Commit to it and track your progress over the next 90 days.</Text>
            <NeonButton
              label={committing ? 'Starting…' : 'Start this plan'}
              onPress={commit}
              disabled={committing}
              style={{ marginTop: Spacing.md }}
            />
          </GlassCard>
        )}

        {bigPicture && (
          <GlassCard style={styles.overallMessageCard}>
            <Text style={styles.overallLabel}>The Big Picture</Text>
            <Text style={styles.overallText}>{bigPicture}</Text>
          </GlassCard>
        )}

        <SectionLabel>The Road Ahead</SectionLabel>
        <View style={styles.roadList}>
          {rows.map((step, i) => {
            const done = step.status === 'done';
            const current = !done && i === firstPendingIndex;
            const isLast = i === rows.length - 1;
            return (
              <TouchableOpacity
                key={step.id}
                style={styles.roadRow}
                onPress={isActive ? () => toggle(step.id, done) : undefined}
                activeOpacity={isActive ? 0.7 : 1}
                disabled={!isActive}
              >
                <View style={styles.rail}>
                  {i > 0 && <View style={[styles.railLine, styles.railLineTop, (done || current) && styles.railLineOn]} />}
                  {!isLast && <View style={[styles.railLine, styles.railLineBottom, done && styles.railLineOn]} />}
                  <View style={[styles.railNode, done && styles.railNodeDone, current && styles.railNodeCurrent]}>
                    {done ? <Text style={styles.railCheck}>✓</Text> : <View style={[styles.railDot, { backgroundColor: catColor(step.category) }]} />}
                  </View>
                </View>
                <View style={styles.roadContent}>
                  <View style={styles.stepHeader}>
                    <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{step.title}</Text>
                    <View style={[styles.weekBadge, done && styles.weekBadgeDone]}>
                      <Text style={[styles.weekText, done && styles.weekTextDone]}>{step.week}</Text>
                    </View>
                  </View>
                  {!done && (
                    <>
                      {current && <Text style={styles.nowTag}>DO THIS NOW</Text>}
                      <Text style={styles.stepDesc}>{step.description}</Text>
                      <Text style={styles.impactValue} numberOfLines={2}>→ {step.impact}</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {isActive && canUpdate && (
          <PressableScale style={styles.updateBanner} onPress={update} haptic="light" disabled={revising}>
            <View style={styles.updateBannerText}>
              <Text style={styles.updateBannerTitle}>{revising ? 'Updating your plan…' : 'Your numbers changed'}</Text>
              <Text style={styles.updateBannerSub}>Update this plan to match your latest check-in.</Text>
            </View>
            <ChevronRightIcon size={18} color={Colors.accent} />
          </PressableScale>
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
  // Preview card (no active plan)
  progressCard: { padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm },
  progressTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  progressSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },

  // Hero — the 90-day journey (full-bleed)
  heroBlock: { marginBottom: Spacing.xl, gap: Spacing.sm },
  heroDay: { fontFamily: Typography.fonts.heading, fontSize: 30, fontWeight: '700', color: Colors.textPrimary },
  heroDayTotal: { fontFamily: Typography.fonts.body, fontSize: Typography.title3.fontSize, fontWeight: '400', color: Colors.textMuted },
  heroFootRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  heroDone: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  heroDelta: { flexShrink: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.accent },

  // Roadmap (the road ahead)
  roadList: { marginTop: Spacing.xs },
  roadRow: { flexDirection: 'row', gap: Spacing.sm },
  rail: { width: 32, position: 'relative' },
  railLine: { position: 'absolute', left: 15, width: 2, backgroundColor: Colors.separator },
  railLineTop: { top: 0, height: 24 },
  railLineBottom: { top: 24, bottom: 0 },
  railLineOn: { backgroundColor: Colors.accentSolid },
  railNode: {
    width: 20, height: 20, borderRadius: 10, marginTop: 15, alignSelf: 'center',
    borderWidth: 2, borderColor: Colors.glassBorderLight, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  railNodeDone: { backgroundColor: Colors.accentSolid, borderColor: Colors.accentSolid },
  railNodeCurrent: { borderColor: Colors.accentSolid, borderWidth: 2.5 },
  railCheck: { fontSize: 11, color: Colors.onAccent, fontWeight: '700' },
  railDot: { width: 7, height: 7, borderRadius: 4 },
  roadContent: { flex: 1, gap: Spacing.xs, paddingVertical: Spacing.md },
  nowTag: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.accent, letterSpacing: 0.6 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  stepTitle: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  stepTitleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  weekBadge: {
    backgroundColor: Colors.accentContainer, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  weekBadgeDone: { backgroundColor: Colors.successContainer },
  weekText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.accent },
  weekTextDone: { color: Colors.success },
  stepDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 19, marginTop: 2 },
  impactValue: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: Spacing.xs },
  updateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.accentContainer, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.lg,
  },
  updateBannerText: { flex: 1, gap: 2 },
  updateBannerTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.accent },
  updateBannerSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  restartLink: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  disclaimer: { marginTop: Spacing.md },
  overallMessageCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  overallLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  overallText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 19, fontStyle: 'italic' },
});
