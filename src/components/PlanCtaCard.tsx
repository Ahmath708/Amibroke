import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { TOOLS } from '@/config/tools';
import StaleBadge from '@/components/StaleBadge';
import PremiumCard from '@/components/PremiumCard';
import { planProgress, PLAN_HORIZON_DAYS, type ActivePlan } from '@/services/activePlan';

const PlanIcon = TOOLS.action_plan.icon; // MapIcon — distinct from the check-in's calendar

export interface PlanCtaFin { income: number; debt: number; savings: number; expenses: number; }

interface Props {
  /** Can use the plan feature (a paid tier OR the free-access window). */
  hasAccess: boolean;
  plan: ActivePlan | null;
  planStale: boolean;
  fin: PlanCtaFin;
  onPlan: () => void; // → ActionPlan (view the plan, or generate one when there's none)
  onPaywall: () => void; // → Paywall
  style?: ViewStyle;
}

// Lead with the user's most salient money issue (severity ladder), qualitative + supportive —
// the contextual hook for building/unlocking the plan. Generic glow-up for the healthy case.
function signalTitle(fin: PlanCtaFin): string {
  if (fin.income > 0 && fin.expenses > 0 && fin.expenses > fin.income) return 'Outspending your income?';
  if (fin.debt > 0) return 'Weighed down by debt?';
  if (fin.expenses > 0 && fin.savings < fin.expenses) return 'No safety net yet?'; // < ~1 month cushion
  return 'Ready for your glow-up?';
}

/**
 * Home plan CTA — contextual, three states:
 *  • no access → unlock (the accent moment, reusing PremiumCard) → Paywall
 *  • access + a committed plan → live progress (calm) → ActionPlan
 *  • access + no plan → build prompt (calm, signal-led) → ActionPlan
 */
export default function PlanCtaCard({ hasAccess, plan, planStale, fin, onPlan, onPaywall, style }: Props) {
  // No access → contextual unlock, framed as the fix for their salient issue.
  if (!hasAccess) {
    return <PremiumCard title={signalTitle(fin)} body={`Unlock your ${TOOLS.action_plan.label}`} onPress={onPaywall} style={style} />;
  }

  // Access + a committed plan → live progress (getActivePlan only returns active plans).
  if (plan) {
    const p = planProgress(plan);
    const day = Math.min(p.daysIn + 1, plan.horizon_days ?? PLAN_HORIZON_DAYS);
    return (
      <PressableScale onPress={onPlan} haptic="light" style={[styles.card, style]}>
        <PlanIcon size={26} color={Colors.textPrimary} />
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Your {TOOLS.action_plan.label}</Text>
            {planStale && <StaleBadge label="Update" />}
          </View>
          <Text style={styles.sub}>Day {day} · {p.pct}% · {p.done} of {p.total} steps</Text>
        </View>
        <ChevronRightIcon size={18} color={Colors.textSecondary} />
      </PressableScale>
    );
  }

  // Access, no plan yet → contextual build prompt.
  return (
    <PressableScale onPress={onPlan} haptic="light" style={[styles.card, style]}>
      <PlanIcon size={26} color={Colors.textPrimary} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{signalTitle(fin)}</Text>
        <Text style={styles.sub}>Start your {TOOLS.action_plan.label}</Text>
      </View>
      <ChevronRightIcon size={18} color={Colors.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  textWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  sub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
});
