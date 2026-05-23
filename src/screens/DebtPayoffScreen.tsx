import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, DebtItem } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import StatusPill from '@/components/StatusPill';
import LoadingState from '@/components/LoadingState';
import { getPurchaseTier, hasAccessTo } from '@/services/purchases';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';

type Props = { route: RouteProp<RootStackParamList, 'DebtPayoff'> };

const DEFAULT_DEBTS: DebtItem[] = [
  { name: 'Chase Sapphire', balance: 4200, interestRate: 24.99, minimumPayment: 84, urgency: 'critical' },
  { name: 'Capital One', balance: 1800, interestRate: 19.99, minimumPayment: 36, urgency: 'high' },
  { name: 'Student Loan', balance: 18000, interestRate: 5.5, minimumPayment: 200, urgency: 'low' },
  { name: 'Car Loan', balance: 8500, interestRate: 7.9, minimumPayment: 280, urgency: 'medium' },
];

type Strategy = 'avalanche' | 'snowball';

function calcPayoff(debts: DebtItem[], extraMonthly: number, strategy: Strategy) {
  const sorted = [...debts].sort((a, b) =>
    strategy === 'avalanche' ? b.interestRate - a.interestRate : a.balance - b.balance
  );
  const totalMin = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const monthlyBudget = totalMin + extraMonthly;
  return Math.round(monthlyBudget > 0 ? (debts.reduce((s, d) => s + d.balance, 0) / monthlyBudget) : 999);
}

export default function DebtPayoffScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'DebtPayoff'>>();
  const debts = route.params?.debts?.length > 0 ? route.params.debts : DEFAULT_DEBTS;
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extra, setExtra] = useState(100);
  const { animatedStyle } = useEntryAnimation();

  useEffect(() => {
    (async () => {
      const tier = await getPurchaseTier();
      if (hasAccessTo(tier, 'deep_dive')) {
        setAuthorized(true);
      } else {
        navigation.replace('Paywall');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState />;
  if (!authorized) return null;

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMin = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const months = calcPayoff(debts, extra, strategy);
  const totalInterestSaved = Math.round(extra * 12 * 0.18);

  const sortedDebts = [...debts].sort((a, b) =>
    strategy === 'avalanche' ? b.interestRate - a.interestRate : a.balance - b.balance
  );

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const urgencyVariant = (u: string) => u === 'critical' ? 'danger' : u === 'high' ? 'warning' : u === 'medium' ? 'info' : 'muted';

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
            <Text style={[styles.summaryNum, { color: Colors.success }]}>{months} mo</Text>
            <Text style={styles.summaryLabel}>Payoff Time</Text>
          </GlassCard>
          <GlassCard style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: Colors.primary }]}>{fmt(totalInterestSaved)}</Text>
            <Text style={styles.summaryLabel}>Interest Saved</Text>
          </GlassCard>
        </View>

        {/* Strategy toggle */}
        <Text style={styles.sectionLabel}>Strategy</Text>
        <View style={styles.segmentRow}>
          {(['avalanche', 'snowball'] as Strategy[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.segment, strategy === s && styles.segmentActive]}
              onPress={() => setStrategy(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, strategy === s && styles.segmentTextActive]}>
                {s === 'avalanche' ? '🌊 Avalanche' : '⛄ Snowball'}
              </Text>
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
        <Text style={styles.sectionLabel}>Extra Monthly Payment</Text>
        <View style={styles.extraGroup}>
          {[0, 50, 100, 200, 500].map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[styles.extraBtn, extra === amt && styles.extraBtnActive]}
              onPress={() => setExtra(amt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.extraBtnText, extra === amt && styles.extraBtnTextActive]}>
                {amt === 0 ? 'Min Only' : `+${fmt(amt)}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Debt list */}
        <Text style={styles.sectionLabel}>Priority Order — {strategy === 'avalanche' ? 'Highest Rate First' : 'Lowest Balance First'}</Text>
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
                    <Text style={styles.debtName}>{debt.name}</Text>
                    <StatusPill label={debt.urgency} variant={urgencyVariant(debt.urgency) as any} />
                  </View>
                  <View style={styles.debtStats}>
                    <Text style={styles.debtStat}>{fmt(debt.balance)}</Text>
                    <Text style={styles.debtStatSep}>·</Text>
                    <Text style={[styles.debtStat, { color: debt.interestRate > 15 ? Colors.danger : Colors.textSecondary }]}>
                      {debt.interestRate}% APR
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
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row', backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md, padding: Spacing.xs, marginBottom: Spacing.md, gap: 2,
  },
  segment: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Colors.groupedRow },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  stratDesc: { padding: Spacing.md, marginBottom: Spacing.xxl },
  stratDescText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  extraGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xxl },
  extraBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  extraBtnActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  extraBtnText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  extraBtnTextActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  debtGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  debtSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 54 },
  debtRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  debtPriority: {
    width: 28, height: 28, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  debtPriorityNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.footnote.fontSize, fontWeight: '700', color: Colors.primary },
  debtInfo: { flex: 1, gap: Spacing.xs },
  debtHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  debtName: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  debtStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  debtStat: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  debtStatSep: { color: Colors.textMuted, fontSize: Typography.caption1.fontSize },
});
