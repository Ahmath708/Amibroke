import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, DebtItem } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { formatCurrency as fmt } from '@/utils/format';
import GlassCard from '@/components/GlassCard';
import SeverityPill from '@/components/SeverityPill';
import SelectableChip from '@/components/SelectableChip';
import ToolSkeleton from '@/components/ToolSkeleton';
import { useRequireEntitlement } from '@/hooks/useRequireEntitlement';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { useAuth } from '@/context/AuthContext';
import { getSnapshot } from '@/services/financialSnapshot';
import { getProfile, updateProfile } from '@/services/profile';
import { getCheckIns, getCheckinConfig } from '@/services/checkins';
import { isPayoffDebt } from '@shared/financialSnapshot';
import ScreenBackground from '@/components/ScreenBackground';
import SectionLabel from '@/components/SectionLabel';
import EmptyState from '@/components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { simulateDebtPayoff } from '@shared/calculations.ts';

type Strategy = 'avalanche' | 'snowball';

const fmtDuration = (m: number) => (m < 24 ? `${m} mo` : `${(m / 12).toFixed(1)} yr`);
const fmtMonth = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export default function DebtPayoffScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'DebtPayoff'>>();
  const { user } = useAuth();
  // Source of truth = the unified snapshot (no per-roast param hand-off). Estimated onboarding
  // placeholders are ignored (no APR/min → useless for payoff).
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(true); // first snapshot fetch — gates the empty-state flash
  // Refetch on focus so debt balances reflect a check-in / edit (returning here shows fresh figures).
  useFocusEffect(useCallback(() => {
    if (!user) return;
    getSnapshot(user.id).then((snap) => {
      const d = snap?.debts;
      // Consumer debt only — mortgages aren't part of the payoff planner (Finding A).
      const payoff = d?.value.filter(isPayoffDebt) ?? [];
      if (d && d.confidence !== 'estimated' && payoff.length > 0) {
        setDebts(payoff.map((x) => ({
          name: x.name, balance: x.balance, interestRate: x.apr ?? 0,
          minimumPayment: x.min_payment ?? 0, urgency: 'medium',
        })));
      }
    }).catch(() => {}).finally(() => setDebtsLoading(false));
  }, [user]));
  const { authorized, loading } = useRequireEntitlement('deep_dive');
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extra, setExtra] = useState(100);
  const [paidDown, setPaidDown] = useState<{ amount: number; since: string } | null>(null);
  const { animatedStyle } = useEntryAnimation();

  // Sticky strategy (profiles.debt_strategy) + paydown progress from check-in history.
  // Sticky strategy + paydown trend — also refetched on focus so progress reflects a new check-in.
  useFocusEffect(useCallback(() => {
    if (!user) return;
    // select('*') stays resilient if debt_strategy isn't migrated yet.
    getProfile(user.id).then((p) => { if (p?.debt_strategy) setStrategy(p.debt_strategy as Strategy); }).catch(() => {});
    Promise.all([getCheckIns(user.id), getCheckinConfig(user.id)]).then(([cis, cfg]) => {
      const debtIds = cfg.goals.filter((g) => g.kind === 'debt').map((g) => g.id);
      if (debtIds.length === 0 || cis.length < 2) return; // need ≥2 check-ins for a trend
      const sumAt = (ci: (typeof cis)[number]) => debtIds.reduce((s, id) => s + (ci.metrics?.[id] ?? 0), 0);
      const sorted = [...cis].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const amount = sumAt(sorted[0]) - sumAt(sorted[sorted.length - 1]); // positive = paid down
      if (Math.abs(amount) >= 1) setPaidDown({ amount, since: sorted[0].created_at });
    }).catch(() => {});
  }, [user]));

  const selectStrategy = (s: Strategy) => {
    setStrategy(s);
    if (user) updateProfile(user.id, { debt_strategy: s }).catch(() => {}); // sticky
  };

  if (loading || debtsLoading) return <ToolSkeleton variant="debt" heroHeight={120} rows={3} rowHeight={72} />;
  if (!authorized) return null;

  if (debts.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="debt" />
        <View style={styles.emptyWrap}>
          <EmptyState
            emoji="🎉"
            title="No debts to plan"
            body="Your latest roast didn’t list any debts. When you’ve got debt to tackle, your payoff plan shows up here."
          />
        </View>
      </View>
    );
  }

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const payoff = simulateDebtPayoff(debts, extra, strategy);
  const baseline = simulateDebtPayoff(debts, 0, strategy);
  const interestSaved = Math.max(0, baseline.totalInterest - payoff.totalInterest);

  const sortedDebts = [...debts].sort((a, b) =>
    strategy === 'avalanche' ? b.interestRate - a.interestRate : a.balance - b.balance
  );


  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="debt" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{fmt(totalDebt)}</Text>
            <Text style={styles.summaryLabel}>Total Debt</Text>
          </GlassCard>
          <GlassCard style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: Colors.success }]}>{payoff.feasible ? fmtDuration(payoff.months) : '50+ yr'}</Text>
            <Text style={styles.summaryLabel}>Payoff Time</Text>
          </GlassCard>
          <GlassCard style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: Colors.accent }]}>{fmt(interestSaved)}</Text>
            <Text style={styles.summaryLabel}>Interest Saved</Text>
          </GlassCard>
        </View>

        {/* Paydown progress — from per-debt check-in history (unified financial model §7) */}
        {paidDown && (
          <GlassCard style={styles.progressCard}>
            <Text style={styles.progressIcon}>{paidDown.amount >= 0 ? '🔥' : '⚠️'}</Text>
            <Text style={styles.progressText}>
              {paidDown.amount >= 0
                ? `You've paid down ${fmt(paidDown.amount)} since ${fmtMonth(paidDown.since)} — keep going.`
                : `Debt is up ${fmt(-paidDown.amount)} since ${fmtMonth(paidDown.since)} — let's turn it around.`}
            </Text>
          </GlassCard>
        )}

        {/* Strategy toggle */}
        <SectionLabel>Strategy</SectionLabel>
        <View style={styles.segmentRow}>
          {(['avalanche', 'snowball'] as Strategy[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.segment, strategy === s && styles.segmentActive]}
              onPress={() => selectStrategy(s)}
              activeOpacity={0.7}
            >
              <View style={styles.segmentInner}>
                <Ionicons
                  name={s === 'avalanche' ? 'flame-outline' : 'snow-outline'}
                  size={15}
                  color={strategy === s ? Colors.textPrimary : Colors.textSecondary}
                />
                <Text style={[styles.segmentText, strategy === s && styles.segmentTextActive]}>
                  {s === 'avalanche' ? 'Avalanche' : 'Snowball'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <GlassCard style={styles.stratDesc}>
          <Text style={styles.stratDescText}>
            {strategy === 'avalanche'
              ? 'Highest interest rate first. Mathematically optimal — saves the most money.'
              : 'Smallest balance first. Psychologically motivating — quick wins keep you going.'}
          </Text>
        </GlassCard>

        {/* Extra payment */}
        <SectionLabel>Extra Monthly Payment</SectionLabel>
        <View style={styles.extraGroup}>
          {[0, 50, 100, 200, 500].map((amt) => (
            <SelectableChip
              key={amt}
              label={amt === 0 ? 'Min Only' : `+${fmt(amt)}`}
              active={extra === amt}
              onPress={() => setExtra(amt)}
            />
          ))}
        </View>

        {/* Debt list */}
        <SectionLabel>Priority Order — {strategy === 'avalanche' ? 'Highest Rate First' : 'Lowest Balance First'}</SectionLabel>
        <View style={styles.debtGroup}>
          {sortedDebts.map((debt, i) => (
            <React.Fragment key={debt.name}>
              {i > 0 && <View style={styles.debtSep} />}
              <View style={styles.debtRow}>
                <View style={styles.debtPriority}>
                  <Text style={styles.debtPriorityNum}>{i + 1}</Text>
                </View>
                <View style={styles.debtInfo}>
                  <View style={styles.debtHeader}>
                    <Text style={styles.debtName} numberOfLines={1}>{debt.name}</Text>
                    <SeverityPill level={debt.urgency} />
                  </View>
                  <View style={styles.debtStats}>
                    <Text style={styles.debtStat}>{fmt(debt.balance)}</Text>
                    <Text style={styles.debtStatSep}>·</Text>
                    <Text style={[styles.debtStat, { color: debt.interestRate > 0.15 ? Colors.danger : Colors.textSecondary }]}>
                      {(debt.interestRate * 100).toFixed(2)}% APR
                    </Text>
                    <Text style={styles.debtStatSep}>·</Text>
                    <Text style={styles.debtStat}>Min {fmt(debt.minimumPayment)}</Text>
                  </View>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xxl },
  summaryCard: { flex: 1, padding: Spacing.md, alignItems: 'center' },
  summaryNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textPrimary },
  summaryLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, marginTop: -Spacing.md, marginBottom: Spacing.xxl },
  progressIcon: { fontSize: 20 },
  progressText: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary, lineHeight: 18 },
  segmentInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentRow: {
    flexDirection: 'row', backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md, padding: Spacing.xs, marginBottom: Spacing.md, gap: 2,
  },
  segment: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Colors.surfaceElevated },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  stratDesc: { padding: Spacing.md, marginBottom: Spacing.xxl },
  stratDescText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  extraGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xxl },
  debtGroup: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  debtSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 54 },
  debtRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  debtPriority: {
    width: 28, height: 28, borderRadius: Radius.lg,
    backgroundColor: Colors.accentContainer, alignItems: 'center', justifyContent: 'center',
  },
  debtPriorityNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.footnote.fontSize, fontWeight: '700', color: Colors.accent },
  debtInfo: { flex: 1, gap: Spacing.xs },
  debtHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  debtName: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  debtStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  debtStat: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  debtStatSep: { color: Colors.textMuted, fontSize: Typography.caption1.fontSize },
});
