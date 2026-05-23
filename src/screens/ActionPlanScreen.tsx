import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ActionStep } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import LoadingState from '@/components/LoadingState';
import Disclaimer from '@/components/Disclaimer';
import { getPurchaseTier, hasAccessTo } from '@/services/purchases';
import { trackActionPlanViewed } from '@/services/analytics';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ActionPlan'>;
  route: RouteProp<RootStackParamList, 'ActionPlan'>;
};

const DEFAULT_STEPS: ActionStep[] = [
  { week: 1, title: 'Emergency Fund Start', description: 'Open a high-yield savings account and automate $25/week transfers.', impact: 'Builds safety net', category: 'savings', completed: false },
  { week: 2, title: 'Subscription Purge', description: 'Cancel all subscriptions you haven\'t used in the last 30 days. No mercy.', impact: 'Saves $80–200/mo', category: 'savings', completed: false },
  { week: 3, title: 'Meal Prep Sunday', description: 'Prep 5 weekday lunches each Sunday to cut eating-out spend by 60%.', impact: 'Saves $120–180/mo', category: 'savings', completed: false },
  { week: 4, title: 'Automate Savings', description: 'Set up a recurring transfer on payday so savings happen before you can spend.', impact: 'Increases savings rate', category: 'savings', completed: false },
  { week: 5, title: 'Credit Card Minimum+', description: 'Pay minimums on all cards, plus $50 extra on the highest-rate card.', impact: 'Reduces interest paid', category: 'debt', completed: false },
  { week: 6, title: 'Side Income Session', description: 'Dedicate 4 hours this week to one income-generating activity.', impact: '+$50–200 this week', category: 'income', completed: false },
  { week: 7, title: 'Negotiate Bills', description: 'Call your internet, phone, and insurance providers and ask for a better rate.', impact: 'Saves $30–80/mo', category: 'savings', completed: false },
  { week: 8, title: '30-Day Review', description: 'Run a new analysis and compare to your starting score. Celebrate progress.', impact: 'Accountability boost', category: 'mindset', completed: false },
];

function generatePersonalizedSteps(analysis: any): ActionStep[] {
  const steps: ActionStep[] = [];
  let week = 1;

  if (analysis.emergencyFundMonths < 3) {
    steps.push({
      week: week++,
      title: 'Build Emergency Fund',
      description: `You have ${analysis.emergencyFundMonths.toFixed(1)} months of emergency fund. Aim for at least 3 months. Start by setting aside $50/week.`,
      impact: 'Increases financial safety net',
      category: 'savings',
      completed: false,
    });
  }

  if (analysis.savingsRate < 0.10) {
    steps.push({
      week: week++,
      title: 'Boost Savings Rate',
      description: `Your savings rate is ${(analysis.savingsRate * 100).toFixed(0)}%. Try to get to at least 10% by cutting discretionary spending.`,
      impact: `Could save ~$${Math.round(analysis.monthlyIncome * 0.1 - analysis.monthlySavings)}/mo`,
      category: 'savings',
      completed: false,
    });
  }

  if (analysis.debtTotal > 0) {
    const highestRateDebt = analysis.debts?.sort((a: any, b: any) => b.interestRate - a.interestRate)[0];
    steps.push({
      week: week++,
      title: 'Attack Highest-Interest Debt',
      description: highestRateDebt
        ? `Focus on ${highestRateDebt.name} at ${highestRateDebt.interestRate}% APR. Pay minimums on everything else, then put extra toward this.`
        : 'Focus on your highest-interest debt first. Pay minimums on everything else.',
      impact: 'Reduces total interest paid',
      category: 'debt',
      completed: false,
    });
  }

  const discretionaryCats = analysis.spendingBreakdown?.filter((c: any) =>
    ['Eating Out', 'Entertainment', 'Shopping', 'DoorDash', 'Uber Eats'].includes(c.name),
  ) || [];
  if (discretionaryCats.length > 0) {
    const topDiscretionary = discretionaryCats.sort((a: any, b: any) => b.amount - a.amount)[0];
    steps.push({
      week: week++,
      title: `Cut ${topDiscretionary.name}`,
      description: `You spend $${topDiscretionary.amount}/mo on ${topDiscretionary.name}. Try cutting it by 50% to save $${Math.round(topDiscretionary.amount * 0.5)}/mo.`,
      impact: `Saves ~$${Math.round(topDiscretionary.amount * 0.5)}/mo`,
      category: 'savings',
      completed: false,
    });
  }

  steps.push({
    week: week++,
    title: 'Automate Your Finances',
    description: 'Set up automatic transfers for savings, bill payments, and debt payments. Remove the friction.',
    impact: 'Prevents missed payments and builds habits',
    category: 'mindset',
    completed: false,
  });

  steps.push({
    week: week++,
    title: 'Monthly Check-In',
    description: 'Run a new analysis in 30 days and compare your score. Track your progress.',
    impact: 'Accountability and motivation',
    category: 'mindset',
    completed: false,
  });

  return steps;
}

export default function ActionPlanScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ActionPlan'>>();
  const rawSteps = route.params?.steps;
  const [steps, setSteps] = useState<ActionStep[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const { animatedStyle } = useEntryAnimation();

  useEffect(() => {
    (async () => {
      const tier = await getPurchaseTier();
      if (hasAccessTo(tier, 'action_plan')) {
        setAuthorized(true);
      } else {
        navigation.replace('Paywall');
      }

      const personalized = rawSteps?.length > 0
        ? rawSteps
        : generatePersonalizedSteps({});

      setSteps(personalized.length > 0 ? personalized : DEFAULT_STEPS);
      trackActionPlanViewed(personalized.length > 0 ? personalized.length : DEFAULT_STEPS.length);
      setLoading(false);
    })();
  }, []);

  const toggle = (week: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  };

  const progress = steps.length > 0 ? Math.round((checked.size / steps.length) * 100) : 0;

  if (loading) return <LoadingState />;
  if (!authorized) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="actionPlan" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress summary */}
        <GlassCard style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{checked.size} of {steps.length} complete</Text>
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressSub}>Keep going — consistency beats intensity every time.</Text>
        </GlassCard>

        {/* Steps — iOS grouped list by week */}
        <Text style={styles.sectionLabel}>Weekly Actions</Text>
        <View style={styles.stepGroup}>
          {steps.map((step, i) => {
            const done = checked.has(step.week);
            return (
              <React.Fragment key={step.week}>
                {i > 0 && <View style={styles.stepSep} />}
                <TouchableOpacity
                  style={styles.stepRow}
                  onPress={() => toggle(step.week)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, done && styles.checkboxDone]}>
                    {done && <Text style={styles.checkmark}>✓</Text>}
                  </View>
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
  progressPct: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.primary },
  progressTrack: { height: 6, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xs, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.xs },
  progressSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  stepGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  stepSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
  stepRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md, alignItems: 'flex-start' },
  checkbox: {
    width: 24, height: 24, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.glassBorderLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  checkboxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontSize: Typography.footnote.fontSize, color: Colors.background, fontWeight: '700' },
  stepContent: { flex: 1, gap: Spacing.xs },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  stepTitle: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  stepTitleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  weekBadge: {
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  weekBadgeDone: { backgroundColor: Colors.successContainer },
  weekText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.primary },
  weekTextDone: { color: Colors.success },
  stepDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 19, marginTop: 2 },
  impactRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  impactLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  impactValue: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.success, fontWeight: '500' },
  disclaimer: { marginTop: Spacing.xl },
});
