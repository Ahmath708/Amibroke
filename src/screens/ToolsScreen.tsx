import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { PressableScale, enterUp } from '@/components/motion';
import { ChevronRightIcon, LockClosedIcon } from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useScrollToTopFast } from '@/hooks/useScrollToTopFast';
import { TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { TOOLS as TOOL_CATALOG, type ToolMeta } from '@/config/tools';
import { formatCompactCurrency } from '@/utils/format';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getAnalysisHistory, getAnalysisById } from '@/services/analyses';
import { getSnapshot } from '@/services/financialSnapshot';
import { getMoneyTrend } from '@/services/moneyTrend';
import { type FinancialSnapshot } from '@shared/financialSnapshot';
import { type MoneyTrend } from '@shared/moneyTrend';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import ScreenBackground from '@/components/ScreenBackground';
import PremiumCard from '@/components/PremiumCard';
import TierPill from '@/components/TierPill';
import Skeleton from '@/components/Skeleton';
import NotificationBell from '@/components/NotificationBell';
import TopScrim from '@/components/TopScrim';
import MoneyTrendCard from '@/components/MoneyTrendCard';

type Props = { navigation: TabScreenNav<'Tools'> };

// Tools shown on this tab (the 90-Day Action Plan lives on the Dashboard, not here), each wired to
// how it opens. Icon + copy come from the shared @/config/tools registry.
const TOOLS: (ToolMeta & { nav?: string; action?: 'debt' })[] = [
  { ...TOOL_CATALOG.subscription_audit, nav: 'SubscriptionAudit' },
  { ...TOOL_CATALOG.debt_payoff, action: 'debt' },
  { ...TOOL_CATALOG.scenario, nav: 'ScenarioSimulator' },
];

export default function ToolsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const onScroll = useScrollToTopFast(scrollRef); // re-tap the active tab → scroll to top (snappy)
  const { user } = useAuth();
  const { tier, hasAccess, refresh, loading: subLoading } = useSubscription();
  const [opening, setOpening] = useState(false);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [trend, setTrend] = useState<MoneyTrend | null>(null);

  // Keep subscription + snapshot + the latest analysis + the money trend fresh on focus. The latest
  // analysis powers the breakdown; the money trend powers the chart. (Debt Payoff re-fetches at TAP time.)
  useFocusEffect(useCallback(() => {
    refresh();
    if (!user) return;
    getSnapshot(user.id).then(setSnapshot).catch(() => {});
    getMoneyTrend(user.id).then(setTrend).catch(() => {});
    getAnalysisHistory(user.id).then(async (h) => {
      const latestId = h?.[0]?.id;
      if (latestId) setAnalysis(await getAnalysisById(latestId).catch(() => null));
    }).catch(() => {});
  }, [refresh, user]));

  // Debt Payoff opens from the user's LATEST analysis (Model A — "latest = your plan"), straight in.
  const openDebtPayoff = useCallback(async () => {
    if (opening || !user) return;
    setOpening(true);
    try {
      const h = await getAnalysisHistory(user.id);
      const latestId = h?.[0]?.id ?? null;
      if (!latestId) {
        Alert.alert('No roast yet', 'Run a roast first, then your tools open right from it.');
        return;
      }
      const a: any = await getAnalysisById(latestId);
      if (!a) return;
      const debts = a.debts ?? [];
      const monthlyIncome = a.monthlyIncome?.value ?? a.monthlyIncome ?? 0;
      (navigation.navigate as any)('DebtPayoff', { debts, monthlyIncome });
    } catch {
      // ignore
    } finally {
      setOpening(false);
    }
  }, [opening, user, navigation]);

  // The money picture behind the tools (unified snapshot — read-only here; edit via FinancialContext).
  const fin = {
    income: snapshot?.monthlyIncome?.value ?? 0,
    expenses: snapshot?.monthlyExpenses?.value ?? 0,
    debt: snapshot?.debtTotal ?? 0,
    savings: snapshot?.liquidSavings?.value ?? 0,
  };
  const hasFinances = fin.income > 0 || fin.expenses > 0 || fin.debt > 0 || fin.savings > 0;
  const cashflowKnown = fin.income > 0 && fin.expenses > 0;
  const net = fin.income - fin.expenses;
  const est = {
    income: snapshot?.monthlyIncome?.confidence === 'estimated',
    expenses: snapshot?.monthlyExpenses?.confidence === 'estimated',
    savings: snapshot?.liquidSavings?.confidence === 'estimated',
  };
  const anyEst = est.income || est.expenses || est.savings;

  const stats = [
    { val: `${est.income ? '~' : ''}${formatCompactCurrency(fin.income)}`, lbl: 'Income/mo' },
    { val: `${est.expenses ? '~' : ''}${formatCompactCurrency(fin.expenses)}`, lbl: 'Spending/mo' },
    { val: formatCompactCurrency(fin.debt), lbl: 'Debt' },
    { val: `${est.savings ? '~' : ''}${formatCompactCurrency(fin.savings)}`, lbl: 'Savings' },
  ];

  // Where-your-money-goes breakdown (50/30/20) from the latest analysis. Clamped so needs + savings ≤ 100
  // and wants is the remainder, so the three always sum to 100 for the bar.
  const bIncome = analysis ? (analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0) : 0;
  const bExpenses = analysis ? (analysis.monthlyExpenses?.value ?? analysis.monthlyExpenses ?? 0) : 0;
  const bSavings = analysis ? (analysis.monthlySavings ?? 0) : 0;
  const hasBreakdown = bIncome > 0;
  const needsPct = hasBreakdown ? Math.min(100, (bExpenses / bIncome) * 100) : 0;
  const savingsPct = hasBreakdown ? Math.max(0, Math.min(100 - needsPct, (bSavings / bIncome) * 100)) : 0;
  const wantsPct = Math.max(0, 100 - needsPct - savingsPct);
  const segments = [
    { lbl: 'Needs', pct: needsPct, color: Colors.textSecondary },
    { lbl: 'Wants', pct: wantsPct, color: Colors.accent },
    { lbl: 'Savings', pct: savingsPct, color: Colors.success },
  ];

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="home" />
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Finances</Text>
            {subLoading ? <Skeleton width={68} height={22} radius={11} /> : <TierPill tier={tier} />}
          </View>
          <NotificationBell />
        </View>
        <Text style={styles.subtitle}>Your money — and the tools to fix it.</Text>

        {/* Money snapshot — the unified financial picture; tap to edit your numbers */}
        {hasFinances && (
          <PressableScale haptic="light" onPress={() => (navigation.navigate as any)('FinancialContext')} style={styles.moneyCard}>
            <View style={styles.moneyHeader}>
              <Text style={styles.cardLabel}>Your Money</Text>
              <View style={styles.editRow}>
                <Text style={styles.editText}>Update</Text>
                <ChevronRightIcon size={14} color={Colors.textMuted} />
              </View>
            </View>
            <View style={styles.moneyGrid}>
              {stats.map((s) => (
                <View key={s.lbl} style={styles.moneyStat}>
                  <Text style={styles.moneyVal}>{s.val}</Text>
                  <Text style={styles.moneyLbl}>{s.lbl}</Text>
                </View>
              ))}
            </View>
            {cashflowKnown && (
              <View style={styles.netRow}>
                <Text style={[styles.netVal, { color: net >= 0 ? Colors.success : Colors.danger }]}>
                  {net >= 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(net))}/mo
                </Text>
                <Text style={styles.netLbl}>{net >= 0 ? 'left over each month' : 'short each month'}</Text>
              </View>
            )}
            {anyEst && <Text style={styles.estFootnote}>~ estimated from your profile — roast to refine</Text>}
          </PressableScale>
        )}

        {/* Where your money goes — 50/30/20 from your latest roast */}
        {hasBreakdown && (
          <View style={styles.sectionCard}>
            <Text style={styles.cardLabel}>Where your money goes</Text>
            <View style={styles.bar}>
              {segments.map((s) => s.pct > 0 && (
                <View key={s.lbl} style={{ flex: s.pct, backgroundColor: s.color }} />
              ))}
            </View>
            <View style={styles.legend}>
              {segments.map((s) => (
                <View key={s.lbl} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text style={styles.legendLbl}>{s.lbl} {Math.round(s.pct)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Money trend — debt / savings / spending over time (merged roasts + check-ins) */}
        {trend && <MoneyTrendCard trend={trend} />}

        {/* Upgrade CTA unless fully unlocked */}
        {tier !== 'deep_dive' && (
          <PremiumCard
            variant={tier === 'action_plan' ? 'upgrade' : 'go'}
            onPress={() => navigation.navigate('Paywall')}
            style={{ marginBottom: Spacing.xl }}
          />
        )}

        <View style={styles.toolsCard}>
          <Text style={[styles.cardLabel, styles.toolsLabel]}>Tools</Text>
          {TOOLS.map((tool, i) => {
            const unlocked = hasAccess(tool.requires);
            const onPress = !unlocked
              ? () => navigation.navigate('Paywall')
              : tool.action
                ? openDebtPayoff
                : () => (navigation.navigate as any)(tool.nav);
            const ToolIcon = tool.icon;
            return (
              <PressableScale key={tool.label} style={[styles.toolRow, i > 0 && styles.toolRowDivider, tool.soon && styles.toolRowSoon]} onPress={onPress} haptic="light" disabled={opening || !!tool.soon}>
                <ToolIcon size={24} color={unlocked ? Colors.textPrimary : Colors.textMuted} />
                <View style={styles.toolText}>
                  <Text style={[styles.toolLabel, !unlocked && styles.labelLocked]} numberOfLines={1}>{tool.label}</Text>
                  <Text style={styles.toolSub} numberOfLines={1}>{!unlocked ? 'Subscribe to unlock' : tool.desc}</Text>
                </View>
                {tool.soon
                  ? <Text style={styles.soon}>Soon</Text>
                  : unlocked
                    ? <ChevronRightIcon size={18} color={Colors.textSecondary} />
                    : <LockClosedIcon size={16} color={Colors.textMuted} />}
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>
      <TopScrim variant="home" />
    </ReAnimated.View>
  );
}

const card = {
  backgroundColor: Colors.surfaceElevated,
  borderRadius: Radius.lg,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: Colors.glassBorderLight,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { ...Typography.screenTitle, fontFamily: Typography.fonts.heading, color: Colors.textPrimary },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xl },

  // Money snapshot card
  moneyCard: { ...card, padding: Spacing.lg, marginBottom: Spacing.lg },
  moneyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  cardLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.textMuted },
  moneyGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  moneyStat: { width: '50%', marginBottom: Spacing.md },
  moneyVal: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, letterSpacing: -0.5 },
  moneyLbl: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, marginTop: 2 },
  netRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: Spacing.xs, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  netVal: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize },
  netLbl: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  estFootnote: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, marginTop: Spacing.sm, fontStyle: 'italic' },

  // Breakdown card
  sectionCard: { ...card, padding: Spacing.lg, marginBottom: Spacing.lg },
  bar: { flexDirection: 'row', height: 10, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.md, marginBottom: Spacing.md },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLbl: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },

  // Tools — one card: internal label + dividered rows (consistent with the data cards above)
  toolsCard: { ...card, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs, marginBottom: Spacing.lg },
  toolsLabel: { paddingTop: Spacing.lg, marginBottom: Spacing.xs },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  toolRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  toolRowSoon: { opacity: 0.5 },
  toolText: { flex: 1 },
  toolLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  labelLocked: { color: Colors.textMuted },
  toolSub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
  soon: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, letterSpacing: 0.3 },
});
