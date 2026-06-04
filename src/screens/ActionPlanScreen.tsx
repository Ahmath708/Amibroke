import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated,
} from 'react-native';
import SectionLabel from '@/components/SectionLabel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ActionStep } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import NeonButton from '@/components/NeonButton';
import LoadingState from '@/components/LoadingState';
import Disclaimer from '@/components/Disclaimer';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { useRequireEntitlement } from '@/hooks/useRequireEntitlement';
import { useAuth } from '@/context/AuthContext';
import {
  getActivePlan, startPlan, setStepStatus, abandonPlan, planProgress, planDelta, type ActivePlan,
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

const CATEGORY_CONFIG: Record<string, { bg: string; color: string }> = {
  savings: { bg: Colors.successContainer, color: Colors.success },
  debt: { bg: Colors.dangerContainer, color: Colors.danger },
  income: { bg: Colors.infoContainer, color: Colors.info },
  mindset: { bg: Colors.accentContainer, color: Colors.accent },
};

function catBg(cat: string): string {
  return CATEGORY_CONFIG[cat]?.bg ?? Colors.glassBackground;
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

  if (loading) return <LoadingState />;
  if (!authorized) return null;

  const isActive = !!plan;
  // Unified row shape: active rows carry id/status; preview rows are pending + synthetic id.
  const rows = isActive
    ? plan!.steps
    : previewSteps.map((s, i) => ({ ...s, id: `p${i}`, status: 'pending' as const, completed_at: null }));
  const prog = plan ? planProgress(plan) : null;
  const delta = plan ? planDelta(plan.start_metrics, latest) : null;
  const bigPicture = isActive ? plan!.overall_message : overallMessage;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="actionPlan" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {isActive ? (
          /* Active plan — committed, tracked */
          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                Day {Math.min(prog!.daysIn + 1, plan!.horizon_days)} of {plan!.horizon_days} · {prog!.done} of {prog!.total} done
              </Text>
              <Text style={styles.progressPct}>{prog!.pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${prog!.pct}%` }]} />
            </View>
            {(delta!.debtPaidDown > 0 || delta!.savingsGained > 0) ? (
              <Text style={styles.progressSub}>
                Since you started
                {delta!.debtPaidDown > 0 ? `: paid down ${formatCurrency(delta!.debtPaidDown)}` : ''}
                {delta!.debtPaidDown > 0 && delta!.savingsGained > 0 ? ' ·' : (delta!.savingsGained > 0 ? ':' : '')}
                {delta!.savingsGained > 0 ? ` saved ${formatCurrency(delta!.savingsGained)}` : ''}.
              </Text>
            ) : (
              <Text style={styles.progressSub}>Keep going — consistency beats intensity every time.</Text>
            )}
          </GlassCard>
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

        <SectionLabel>Weekly Actions</SectionLabel>
        <View style={styles.stepGroup}>
          {rows.map((step, i) => {
            const done = step.status === 'done';
            return (
              <React.Fragment key={step.id}>
                {i > 0 && <View style={styles.stepSep} />}
                <TouchableOpacity
                  style={styles.stepRow}
                  onPress={isActive ? () => toggle(step.id, done) : undefined}
                  activeOpacity={isActive ? 0.7 : 1}
                  disabled={!isActive}
                >
                  {isActive && (
                    <View style={[styles.checkbox, done && styles.checkboxDone]}>
                      {done && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  )}
                  <View style={styles.stepContent}>
                    <View style={styles.stepHeader}>
                      <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{step.title}</Text>
                      <View style={[styles.weekBadge, done && styles.weekBadgeDone]}>
                        <Text style={[styles.weekText, done && styles.weekTextDone]}>Wk {step.week}</Text>
                      </View>
                    </View>
                    {!done && (
                      <>
                        <Text style={styles.stepDesc}>{step.description}</Text>
                        <View style={styles.badgeRow}>
                          {step.category && (
                            <View style={[styles.catBadge, { backgroundColor: catBg(step.category) }]}>
                              <Text style={styles.catText}>{step.category}</Text>
                            </View>
                          )}
                          {step.confidence && <ConfidenceBadge level={step.confidence} />}
                        </View>
                        <View style={styles.impactRow}>
                          <Text style={styles.impactLabel}>Impact:</Text>
                          <Text style={styles.impactValue}>{step.impact}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

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
  progressCard: { padding: Spacing.lg, marginBottom: Spacing.xxl, gap: Spacing.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  progressPct: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.accent },
  progressTrack: { height: 6, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xs, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: Radius.xs },
  progressSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  stepGroup: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  stepSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
  stepRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md, alignItems: 'flex-start' },
  checkbox: {
    width: 24, height: 24, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.glassBorderLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  checkboxDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkmark: { fontSize: Typography.footnote.fontSize, color: Colors.background, fontWeight: '700' },
  stepContent: { flex: 1, gap: Spacing.xs },
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
  impactRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  impactLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  impactValue: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.success, fontWeight: '500' },
  restartLink: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  disclaimer: { marginTop: Spacing.md },
  overallMessageCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  overallLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  overallText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 19, fontStyle: 'italic' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: Spacing.xs },
  catBadge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  catText: { fontFamily: Typography.fonts.bodySemi, fontSize: 10, fontWeight: '600', letterSpacing: 0.2, color: Colors.textPrimary },
});
