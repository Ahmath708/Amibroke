import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronRightIcon, CreditCardIcon, ArrowPathRoundedSquareIcon,
  CalculatorIcon, AdjustmentsHorizontalIcon,
} from 'react-native-heroicons/solid';
import { PressableScale, enterUp } from '@/components/motion';
import { useScrollToTopFast } from '@/hooks/useScrollToTopFast';
import { TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import { getSnapshot, mergeSnapshot } from '@/services/financialSnapshot';
import { isPayoffDebt, type FinancialSnapshot, type Confidence } from '@shared/financialSnapshot';
import { getSpending } from '@/services/spending';
import type { SpendingItem } from '@shared/spending';
import { getSubscriptions } from '@/services/subscriptionAudit';
import { toMonthly } from '@shared/billingPeriod';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import ScreenBackground from '@/components/ScreenBackground';
import TopScrim from '@/components/TopScrim';
import Skeleton from '@/components/Skeleton';
import BottomSheet from '@/components/BottomSheet';
import DecimalInput from '@/components/DecimalInput';
import SelectableChip from '@/components/SelectableChip';
import NeonButton from '@/components/NeonButton';

type Props = { navigation: TabScreenNav<'Financials'> };

type EditKey = 'income' | 'expenses' | 'savings';
const EDIT_LABEL: Record<EditKey, string> = { income: 'Monthly income', expenses: 'Monthly expenses', savings: 'Savings balance' };
// Quick-fill brackets (mirror onboarding) — tapping one fills the exact field; everything is saved
// as a user-asserted figure (manual / stated).
const EDIT_RANGES: Record<EditKey, [string, number][]> = {
  income: [['Under $2k', 1500], ['$2k–$4k', 3000], ['$4k–$6k', 5000], ['$6k–$10k', 8000], ['$10k+', 12000]],
  expenses: [['Under $2k', 1500], ['$2k–$4k', 3000], ['$4k–$6k', 5000], ['$6k–$10k', 8000], ['$10k+', 12000]],
  savings: [['None', 0], ['Under $500', 250], ['$500–$2k', 1250], ['$2k–$10k', 6000], ['$10k–$50k', 30000], ['$50k+', 60000]],
};

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export default function FinancialsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const onScroll = useScrollToTopFast(scrollRef);
  const { user } = useAuth();

  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [spending, setSpending] = useState<SpendingItem[]>([]);
  const [subsMonthly, setSubsMonthly] = useState(0);
  const [subsCount, setSubsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);

  const [editKey, setEditKey] = useState<EditKey | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!user) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [snap, spend, subs] = await Promise.all([getSnapshot(user.id), getSpending(user.id), getSubscriptions(user.id)]);
      setSnapshot(snap);
      setSpending(spend ?? []);
      setSubsMonthly((subs ?? []).reduce((a, s) => a + toMonthly(s.amount, s.billing_period), 0));
      setSubsCount((subs ?? []).length);
    } catch {
      // keep prior state
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    load(!firstLoad.current);
    firstLoad.current = false;
  }, [load]));

  const openEdit = (k: EditKey) => {
    const cur = k === 'income' ? snapshot?.monthlyIncome?.value
      : k === 'expenses' ? snapshot?.monthlyExpenses?.value
      : snapshot?.liquidSavings?.value;
    setDraft(cur != null ? String(Math.round(cur)) : '');
    setEditKey(k);
  };

  const saveEdit = useCallback(async () => {
    if (!user || !editKey || saving) return;
    const n = Math.max(0, Math.round(parseFloat(draft) || 0));
    const conf: Confidence = 'stated';
    const patch = editKey === 'income' ? { monthlyIncome: { value: n, confidence: conf } }
      : editKey === 'expenses' ? { monthlyExpenses: { value: n, confidence: conf } }
      : { liquidSavings: { value: n, confidence: conf } };
    setSaving(true);
    try {
      await mergeSnapshot(user.id, patch, 'manual');
      setEditKey(null);
      await load(true);
    } finally {
      setSaving(false);
    }
  }, [user, editKey, draft, saving, load]);

  // ── derived ──
  const income = snapshot?.monthlyIncome?.value ?? 0;
  const expenses = snapshot?.monthlyExpenses?.value ?? 0;
  const savings = snapshot?.liquidSavings?.value ?? 0;
  const surplus = income - expenses;
  const rate = income > 0 ? Math.round((surplus / income) * 100) : 0;
  const emFund = expenses > 0 ? savings / expenses : 0;
  const emThin = emFund < 1;
  const dti = snapshot?.debtToIncome != null ? Math.round(snapshot.debtToIncome * 100)
    : (income > 0 ? Math.round(((snapshot?.debtTotal ?? 0) / (income * 12)) * 100) : 0);
  const dtiOk = dti < 36;
  const outPct = income > 0 ? Math.min(100, Math.round((expenses / income) * 100)) : 100;

  const debtTotal = snapshot?.debtTotal ?? 0;
  const debtCount = (snapshot?.debts?.value ?? []).filter(isPayoffDebt).length;

  const spendSorted = [...spending].sort((a, b) => b.amount - a.amount);
  const spendNamed = spending.reduce((a, s) => a + s.amount, 0);
  const spendMax = spendSorted.length ? spendSorted[0].amount : 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="home" />
        <View style={[styles.scroll, { paddingTop: insets.top + Spacing.xxl }]}>
          <Skeleton width={140} height={28} radius={9} style={{ marginBottom: Spacing.lg }} />
          <Skeleton width="100%" height={120} radius={20} style={{ marginBottom: Spacing.xxl }} />
          <Skeleton width={120} height={28} radius={9} style={{ marginBottom: Spacing.lg }} />
          <Skeleton width="100%" height={150} radius={20} />
        </View>
        <TopScrim variant="home" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── The Bleed (cash flow) ── */}
        <ReAnimated.View entering={enterUp(0)} style={styles.section}>
          <Text style={styles.h2}>The Bleed</Text>
          <View style={styles.bleedCard}>
            <View style={styles.bleedRow}>
              <PressableScale haptic="light" onPress={() => openEdit('income')} style={styles.bleedCol}>
                <View style={styles.bleedLabelRow}>
                  <Text style={styles.bleedLabel}>Money In</Text>
                  <ChevronRightIcon size={12} color={Colors.textTertiary} />
                </View>
                <Text style={styles.bleedNum}>{fmt(income)}</Text>
              </PressableScale>
              <Text style={styles.bleedSlash}>/</Text>
              <PressableScale haptic="light" onPress={() => openEdit('expenses')} style={[styles.bleedCol, styles.bleedColOut]}>
                <View style={[styles.bleedLabelRow, styles.bleedLabelRowOut]}>
                  <Text style={styles.bleedLabel}>Money Out</Text>
                  <ChevronRightIcon size={12} color={Colors.textTertiary} />
                </View>
                <Text style={[styles.bleedNum, styles.bleedNumOut]}>{fmt(expenses)}</Text>
              </PressableScale>
            </View>
            <View style={styles.flowBar}><View style={[styles.flowOut, { width: `${outPct}%` }]} /></View>
            <Text style={styles.bleedFoot}>
              <Text style={styles.bleedFootB}>{(surplus >= 0 ? '+' : '−') + fmt(Math.abs(surplus))}</Text>
              {surplus >= 0 ? ' survives the month' : ' short this month'} · {rate}% saved
            </Text>
          </View>
        </ReAnimated.View>

        {/* ── The Vitals ── */}
        <ReAnimated.View entering={enterUp(1)} style={styles.section}>
          <Text style={styles.h2}>The Vitals</Text>
          <Text style={styles.subH}>Two numbers that decide if you'd survive a bad month.</Text>
          <PressableScale haptic="light" onPress={() => openEdit('savings')} style={styles.savingsRow}>
            <View style={styles.savingsLabel}>
              <View style={[styles.dot, { backgroundColor: Colors.secondary, shadowColor: Colors.secondary }]} />
              <Text style={styles.savingsLabelText}>Savings balance</Text>
            </View>
            <View style={styles.savingsValWrap}>
              <Text style={styles.savingsVal}>{fmt(savings)}</Text>
              <ChevronRightIcon size={14} color={Colors.textTertiary} />
            </View>
          </PressableScale>
          <View style={styles.vitalsRow}>
            <View style={styles.vital}>
              <View style={styles.mTop}>
                <View style={[styles.dot, { backgroundColor: emThin ? Colors.danger : Colors.success, shadowColor: emThin ? Colors.danger : Colors.success }]} />
                <Text style={styles.mLabel}>Emergency fund</Text>
              </View>
              <Text style={styles.mValue}>{emFund.toFixed(1)} mo</Text>
              <Text style={[styles.mFoot, { color: emThin ? Colors.danger : Colors.success }]}>{emThin ? 'thin · aim for 1+' : 'solid · 1+ mo'}</Text>
            </View>
            <View style={styles.vital}>
              <View style={styles.mTop}>
                <View style={[styles.dot, { backgroundColor: dtiOk ? Colors.success : Colors.danger, shadowColor: dtiOk ? Colors.success : Colors.danger }]} />
                <Text style={styles.mLabel}>Debt-to-income</Text>
              </View>
              <Text style={styles.mValue}>{dti}%</Text>
              <Text style={[styles.mFoot, { color: dtiOk ? Colors.success : Colors.danger }]}>{dtiOk ? 'healthy · under 36%' : 'high · over 36%'}</Text>
            </View>
          </View>
        </ReAnimated.View>

        {/* ── Where your money goes ── */}
        <ReAnimated.View entering={enterUp(2)} style={styles.section}>
          <Text style={styles.h2}>Where your money goes</Text>
          <Text style={styles.subH}>Your named monthly spending.</Text>
          {spendNamed > 0 ? (
            <View style={styles.spendCard}>
              {spendSorted.slice(0, 5).map((s) => (
                <View key={s.id ?? s.category} style={styles.spendItem}>
                  <View style={styles.spendTop}>
                    <Text style={styles.spendName}>{s.category}</Text>
                    <Text style={styles.spendAmt}>{fmt(s.amount)}</Text>
                  </View>
                  <View style={styles.spendTrack}><View style={[styles.spendFill, { width: `${spendMax > 0 ? Math.max(4, Math.round((s.amount / spendMax) * 100)) : 0}%` }]} /></View>
                </View>
              ))}
              <View style={styles.spendFoot}>
                <Text style={styles.spendFootLbl}>{spending.length} {spending.length === 1 ? 'category' : 'categories'} tracked</Text>
                <Text style={styles.spendFootTot}>{fmt(spendNamed)}/mo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.spendEmpty}>
              <Text style={styles.spendEmptyText}>Nothing named yet — add a category, or your next roast will fill this in.</Text>
            </View>
          )}
          <PressableScale haptic="light" onPress={() => (navigation.navigate as any)('SpendingEditor')} style={styles.spendCta}>
            <Text style={styles.spendCtaText}>Edit spending</Text>
            <ChevronRightIcon size={15} color={Colors.accentSolid} />
          </PressableScale>
        </ReAnimated.View>

        {/* ── What You Owe ── */}
        <ReAnimated.View entering={enterUp(3)} style={styles.section}>
          <Text style={styles.h2}>What You Owe</Text>
          <Text style={styles.subH}>Debt and subscriptions, each with its own manager.</Text>
          <View style={styles.oweList}>
            <PressableScale haptic="light" onPress={() => (navigation.navigate as any)('DebtManager')} style={styles.oweRow}>
              <View style={styles.oweIco}><CreditCardIcon size={20} color={Colors.accentSolid} /></View>
              <View style={styles.oweBody}>
                <Text style={styles.oweTitle}>Debts</Text>
                <Text style={styles.oweSub}>{debtCount === 0 ? 'none tracked' : `${debtCount} ${debtCount === 1 ? 'debt' : 'debts'}`}</Text>
              </View>
              <Text style={styles.oweAmt}>{fmt(debtTotal)}</Text>
              <ChevronRightIcon size={18} color={Colors.textTertiary} />
            </PressableScale>
            <PressableScale haptic="light" onPress={() => navigation.navigate('SubscriptionAudit')} style={styles.oweRow}>
              <View style={styles.oweIco}><ArrowPathRoundedSquareIcon size={20} color={Colors.accentSolid} /></View>
              <View style={styles.oweBody}>
                <Text style={styles.oweTitle}>Subscriptions</Text>
                <Text style={styles.oweSub}>{subsCount} active</Text>
              </View>
              <Text style={styles.oweAmt}>{fmt(subsMonthly)}<Text style={styles.oweAmtSuf}>/mo</Text></Text>
              <ChevronRightIcon size={18} color={Colors.textTertiary} />
            </PressableScale>
          </View>
        </ReAnimated.View>

        {/* ── The Lab ── */}
        <ReAnimated.View entering={enterUp(4)} style={styles.section}>
          <Text style={styles.h2}>The Lab</Text>
          <View style={styles.labList}>
            <PressableScale haptic="light" onPress={() => navigation.navigate('DebtPayoff')} style={styles.labCard}>
              <View style={styles.labIco}><CalculatorIcon size={22} color={Colors.accentSolid} /></View>
              <View style={styles.labBody}>
                <Text style={styles.labTitle}>Debt Payoff Estimator</Text>
                <Text style={styles.labSub}>See how long it'll actually take to be debt-free.</Text>
              </View>
              <ChevronRightIcon size={18} color={Colors.textTertiary} />
            </PressableScale>
            <View style={[styles.labCard, styles.labCardSoon]}>
              <View style={[styles.labIco, styles.labIcoSoon]}><AdjustmentsHorizontalIcon size={22} color={Colors.textTertiary} /></View>
              <View style={styles.labBody}>
                <View style={styles.labTitleRow}>
                  <Text style={styles.labTitle}>Scenario Simulator</Text>
                  <View style={styles.soonBadge}><Text style={styles.soonBadgeText}>Coming Soon</Text></View>
                </View>
                <Text style={styles.labSub}>Play out "what if I threw $200 more at the loan?"</Text>
              </View>
            </View>
          </View>
        </ReAnimated.View>
      </ScrollView>
      <TopScrim variant="home" />

      {/* ── tap-to-edit scalar sheet (exact amount + quick-fill brackets) ── */}
      <BottomSheet visible={editKey != null} onClose={() => setEditKey(null)} title={editKey ? EDIT_LABEL[editKey] : ''} scrollable={false}>
        <View style={styles.editBody}>
          <Text style={styles.fieldLabel}>Exact amount</Text>
          <DecimalInput value={draft} onChangeValue={setDraft} prefix="$" placeholder="0" autoFocus />
          <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Or pick a range</Text>
          <View style={styles.chips}>
            {(editKey ? EDIT_RANGES[editKey] : []).map(([label, val]) => (
              <SelectableChip key={label} label={label} active={Number(draft) === val} onPress={() => setDraft(String(val))} />
            ))}
          </View>
          <NeonButton label="Save" onPress={saveEdit} loading={saving} style={{ marginTop: Spacing.xl }} />
        </View>
      </BottomSheet>
    </View>
  );
}

const card = {
  backgroundColor: Colors.backgroundSecondary,
  borderRadius: Radius.xxl,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: Colors.glassBorder,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  h2: { fontFamily: Typography.fonts.extrabold, fontSize: 25, letterSpacing: -0.8, color: Colors.textPrimary, marginBottom: 13 },
  subH: { fontFamily: Typography.fonts.bodyMed, fontSize: 12.5, color: Colors.textSecondary, marginTop: -7, marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },

  // The Bleed
  bleedCard: { ...card, paddingVertical: 18, paddingHorizontal: 20 },
  bleedRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bleedCol: { gap: 6 },
  bleedColOut: { alignItems: 'flex-end' },
  bleedLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bleedLabelRowOut: { flexDirection: 'row-reverse' },
  bleedLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.textTertiary },
  bleedNum: { fontFamily: Typography.fonts.extrabold, fontSize: 33, letterSpacing: -1.4, color: Colors.textPrimary },
  bleedNumOut: { color: Colors.textSecondary },
  bleedSlash: { fontFamily: Typography.fonts.body, fontSize: 26, color: 'rgba(255,255,255,0.16)', paddingBottom: 2 },
  flowBar: { marginTop: 20, height: 10, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  flowOut: { height: '100%', borderRadius: Radius.pill, backgroundColor: Colors.accentSolid },
  bleedFoot: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary, marginTop: 13 },
  bleedFootB: { fontFamily: Typography.fonts.mono, color: Colors.textPrimary },

  // The Vitals
  savingsRow: { ...card, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 15, marginBottom: 10 },
  savingsLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  savingsLabelText: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, color: Colors.textSecondary },
  savingsValWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  savingsVal: { fontFamily: Typography.fonts.monoSemi, fontSize: 17, letterSpacing: -0.4, color: Colors.textPrimary },
  vitalsRow: { flexDirection: 'row', gap: 10 },
  vital: { ...card, flex: 1, borderRadius: Radius.xl, paddingVertical: 14, paddingHorizontal: 12, gap: 9 },
  mTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.2 },
  mValue: { fontFamily: Typography.fonts.monoSemi, fontSize: 19, letterSpacing: -0.8, color: Colors.textPrimary },
  mFoot: { fontFamily: Typography.fonts.bodySemi, fontSize: 10.5, letterSpacing: -0.1 },

  // Where your money goes
  spendCard: { ...card, paddingVertical: 17, paddingHorizontal: 19 },
  spendItem: { marginBottom: 16 },
  spendTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  spendName: { fontFamily: Typography.fonts.bodySemi, fontSize: 13.5, color: 'rgba(255,255,255,0.84)', letterSpacing: -0.2 },
  spendAmt: { fontFamily: Typography.fonts.monoSemi, fontSize: 13.5, color: Colors.textPrimary, letterSpacing: -0.3 },
  spendTrack: { height: 8, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  spendFill: { height: '100%', borderRadius: Radius.pill, backgroundColor: Colors.accentSolid },
  spendFoot: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.glassBorder, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  spendFootLbl: { fontFamily: Typography.fonts.bodySemi, fontSize: 12, color: Colors.textSecondary },
  spendFootTot: { fontFamily: Typography.fonts.monoSemi, fontSize: 14, color: Colors.textPrimary, letterSpacing: -0.4 },
  spendEmpty: { ...card, padding: Spacing.lg },
  spendEmptyText: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  spendCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, paddingVertical: 13, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder },
  spendCtaText: { fontFamily: Typography.fonts.bodySemi, fontSize: 14, color: Colors.accentSolid, letterSpacing: -0.2 },

  // What You Owe
  oweList: { gap: 10 },
  oweRow: { ...card, borderRadius: Radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16 },
  oweIco: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentContainer, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder },
  oweBody: { flex: 1 },
  oweTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.2 },
  oweSub: { fontFamily: Typography.fonts.body, fontSize: 12.5, color: Colors.textSecondary, marginTop: 3 },
  oweAmt: { fontFamily: Typography.fonts.extrabold, fontSize: 20, letterSpacing: -0.5, color: Colors.textPrimary },
  oweAmtSuf: { fontFamily: Typography.fonts.bodySemi, fontSize: 12, color: Colors.textSecondary },

  // The Lab
  labList: { gap: 11 },
  labCard: { ...card, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16 },
  labCardSoon: { opacity: 0.5 },
  labIco: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentContainer, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder },
  labIcoSoon: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: Colors.glassBorder },
  labBody: { flex: 1 },
  labTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: 15.5, color: Colors.textPrimary, letterSpacing: -0.2 },
  labSub: { fontFamily: Typography.fonts.body, fontSize: 12.5, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  soonBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: Radius.sm, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder },
  soonBadgeText: { fontFamily: Typography.fonts.extrabold, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: Colors.textSecondary },

  // Edit sheet
  editBody: { paddingBottom: Spacing.sm },
  fieldLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: Colors.textTertiary, marginBottom: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
