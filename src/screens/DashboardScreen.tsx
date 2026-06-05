import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { PressableScale, enterUp } from '@/components/motion';
import Svg, { Polyline } from 'react-native-svg';
import {
  ArrowUpIcon, ArrowDownIcon, ArrowLongRightIcon, ChevronRightIcon, WrenchScrewdriverIcon,
} from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AnalysisHistoryItem, TabScreenNav, RoastTone } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getAnalysisHistory, getAnalysisById } from '@/services/analyses';
import { getProfile } from '@/services/profile';
import { getSnapshot, buildRescoreInput } from '@/services/financialSnapshot';
import type { FinancialSnapshot } from '@shared/financialSnapshot';
import { getActivePlan, shouldRevisePlan, type ActivePlan } from '@/services/activePlan';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import StaleBadge from '@/components/StaleBadge';
import { FEATURES } from '@/config/features';
import { capitalize } from '@/utils/string';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import ScreenBackground from '@/components/ScreenBackground';
import StatusPill from '@/components/StatusPill';
import ScoreRing from '@/components/ScoreRing';
import NeonButton from '@/components/NeonButton';
import NotificationBell from '@/components/NotificationBell';
import PremiumCard from '@/components/PremiumCard';
import CheckinCard from '@/components/CheckinCard';
import Skeleton from '@/components/Skeleton';

type Props = { navigation: TabScreenNav<'Home'> };

// Sparkline box
const SPARK_W = 140;
const SPARK_H = 40;

// Time-of-day greeting for the home header (warmer than a static wordmark).
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Compact money for the snapshot tiles: $0 · $250 · $5.2k · $12k.
function fmtMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier, canUseApp } = useSubscription();
  const { lastCheckIn } = useCheckinStatus();

  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [tone, setTone] = useState<RoastTone>('savage');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [firstName, setFirstName] = useState('');
  const firstLoad = useRef(true);

  // Name for the greeting — onboarding first_name, else display_name / @username (first token).
  useEffect(() => {
    if (!user) { setFirstName(''); return; }
    getProfile(user.id)
      .then((p) => {
        const fromName = (p?.display_name || p?.username || '').trim().split(/\s+/)[0];
        const first = (p?.first_name?.trim()) || fromName || '';
        setFirstName(capitalize(first));
        setTone((p?.preferred_tone as RoastTone) ?? 'savage'); // for the refresh re-score
      })
      .catch(() => {});
  }, [user]);

  const load = useCallback(async (silent = false) => {
    if (!user) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [hist, snap, p] = await Promise.all([getAnalysisHistory(user.id), getSnapshot(user.id), getActivePlan(user.id)]);
      setHistory(hist ?? []);
      setSnapshot(snap);
      setPlan(p);
    } catch {
      // keep whatever we had
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load(!firstLoad.current);
      firstLoad.current = false;
    }, [load]),
  );

  const openAnalysis = useCallback(async (id: string) => {
    if (opening) return;
    setOpening(true);
    try {
      const analysis = await getAnalysisById(id);
      if (analysis) (navigation.navigate as any)('Results', { analysis, userInput: '' });
    } catch {
      // ignore
    } finally {
      setOpening(false);
    }
  }, [opening, navigation]);

  // Snapshot-driven re-score: reconstruct the input (no re-typing), run analyze. Paywall-gated
  // like any roast — expired-free users land on the Paywall, exactly as if they tried to roast.
  const onRescore = useCallback(async () => {
    if (!user) return;
    if (FEATURES.PAYWALL_ENFORCEMENT && !canUseApp) { (navigation.navigate as any)('Paywall'); return; }
    const input = await buildRescoreInput(user.id, history[0]?.id);
    if (input) (navigation.navigate as any)('Processing', { userInput: input, tone });
  }, [user, canUseApp, navigation, tone, history]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="home" />
        <View style={[styles.scroll, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.header}>
            <View style={styles.greeting}>
              <Skeleton width={110} height={13} style={{ marginBottom: Spacing.sm }} />
              <Skeleton width={170} height={30} radius={9} />
            </View>
            <Skeleton width={40} height={40} radius={20} />
          </View>
          <View style={{ alignItems: 'center', marginTop: Spacing.xxl }}>
            <Skeleton width={184} height={184} radius={92} />
            <Skeleton width={130} height={14} style={{ marginTop: Spacing.lg }} />
          </View>
          <Skeleton width="100%" height={56} radius={16} style={{ marginTop: Spacing.xxl }} />
        </View>
      </View>
    );
  }

  // First run (no analyses yet) → keep the dashboard shell with an empty "?/100" hero that
  // previews the destination and invites the first roast (instead of dropping into the raw input).
  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="home" />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <ReAnimated.View entering={enterUp(0)} style={styles.header}>
            <View style={styles.greeting}>
              {firstName ? (
                <>
                  <Text style={styles.greetingLead}>{timeGreeting()},</Text>
                  <Text style={styles.greetingName} numberOfLines={1}>{firstName}</Text>
                </>
              ) : (
                <Text style={styles.greetingName} numberOfLines={1}>{timeGreeting()}</Text>
              )}
            </View>
            <NotificationBell />
          </ReAnimated.View>

          <ReAnimated.View entering={enterUp(1)} style={styles.emptyHero}>
            <ScoreRing score={0} size={150} showOutOf empty />
            <Text style={styles.emptyTitle}>Your score is waiting</Text>
            <Text style={styles.emptySub}>Run your first roast to unlock your score, breakdown, and plan.</Text>
          </ReAnimated.View>

          <ReAnimated.View entering={enterUp(2)}>
            <NeonButton label="Start your first roast" onPress={() => navigation.navigate('Analyze')} />
          </ReAnimated.View>
        </ScrollView>
      </View>
    );
  }

  const latest = history[0];
  const prev = history[1];
  const band = getScoreBand(latest.score);
  const delta = prev ? latest.score - prev.score : null;

  // Snapshot figures behind the score (the unified financial snapshot — read-only here).
  const fin = {
    income: snapshot?.monthlyIncome?.value ?? 0,
    debt: snapshot?.debtTotal ?? 0,
    savings: snapshot?.liquidSavings?.value ?? 0,
  };
  const hasFinances = fin.income > 0 || fin.debt > 0 || fin.savings > 0;
  // Provenance: brackets from onboarding read 'estimated' until a roast pins them (debt is never
  // bracket-seeded, so it's always real). Flag estimated figures with a "~".
  const est = {
    income: snapshot?.monthlyIncome?.confidence === 'estimated',
    savings: snapshot?.liquidSavings?.confidence === 'estimated',
  };
  const anyEst = est.income || est.savings;

  // Stale-state: the score is stale when you've checked in since your last roast; the plan reuses
  // the existing value-aware shouldRevisePlan (gated to a material change).
  const scoreStale = !!lastCheckIn && new Date(lastCheckIn.created_at) > new Date(latest.created_at);
  const revSnap = snapshot
    ? { debtTotal: snapshot.debtTotal, liquidSavings: snapshot.liquidSavings?.value ?? null, monthlyIncome: snapshot.monthlyIncome?.value ?? null, score: snapshot.score }
    : null;
  const planStale = !!plan && shouldRevisePlan(plan, revSnap).revise;

  // Chronological scores for the sparkline (oldest → newest), last 8.
  const series = [...history].slice(0, 8).reverse().map((h) => h.score);
  const sMin = Math.min(...series), sMax = Math.max(...series);
  const span = Math.max(1, sMax - sMin);
  const points = series
    .map((v, i) => {
      const x = series.length === 1 ? SPARK_W / 2 : (i / (series.length - 1)) * SPARK_W;
      const y = SPARK_H - ((v - sMin) / span) * SPARK_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: time-aware greeting (small lead + name hero) + avatar → Profile */}
        <ReAnimated.View entering={enterUp(0)} style={styles.header}>
          <View style={styles.greeting}>
            {firstName ? (
              <>
                <Text style={styles.greetingLead}>{timeGreeting()},</Text>
                <Text style={styles.greetingName} numberOfLines={1}>{firstName}</Text>
              </>
            ) : (
              <Text style={styles.greetingName} numberOfLines={1}>{timeGreeting()}</Text>
            )}
          </View>
          <NotificationBell />
        </ReAnimated.View>

        {/* Score hero — focal glow on the home score; tap to reopen your latest roast */}
        <ReAnimated.View entering={enterUp(1)}>
          <PressableScale style={styles.hero} onPress={() => openAnalysis(latest.id)} haptic="light" disabled={opening}>
            <ScoreRing score={latest.score} size={140} showOutOf glow />
            <View style={styles.heroMeta}>
              <StatusPill label={band.label} color={band.color} />
              {delta != null && delta !== 0 && (
                <View style={styles.deltaRow}>
                  {delta > 0
                    ? <ArrowUpIcon size={13} color={Colors.success} />
                    : <ArrowDownIcon size={13} color={Colors.danger} />}
                  <Text style={[styles.deltaText, { color: delta > 0 ? Colors.success : Colors.danger }]}>
                    {Math.abs(delta)} since last
                  </Text>
                </View>
              )}
              <Text style={styles.checkedDate}>Tap to view · checked {fmt(latest.created_at)}</Text>
            </View>
          </PressableScale>
        </ReAnimated.View>

        {/* Score staleness — tap to re-score from the snapshot (no re-typing); paywall-gated */}
        {scoreStale && (
          <ReAnimated.View entering={enterUp(2)}>
            <PressableScale onPress={onRescore} haptic="light" style={styles.staleBanner}>
              <StaleBadge label="Score may be out of date" />
              <Text style={styles.refreshCta}>Refresh ↻</Text>
            </PressableScale>
          </ReAnimated.View>
        )}

        {/* Your finances — the snapshot behind the score (unified financial model read path) */}
        {hasFinances && (
          <ReAnimated.View entering={enterUp(3)}>
            <View style={styles.financeCard}>
              <View style={styles.tileHeader}>
                <Text style={styles.tileLabel}>Your Finances</Text>
              </View>
              <View style={styles.financeRow}>
                <View style={styles.financeStat}>
                  <Text style={styles.financeVal}>{est.income ? '~' : ''}{fmtMoney(fin.income)}</Text>
                  <Text style={styles.financeLbl}>Income/mo</Text>
                </View>
                <View style={styles.financeStat}>
                  <Text style={[styles.financeVal, { color: fin.debt > 0 ? Colors.danger : Colors.success }]}>{fmtMoney(fin.debt)}</Text>
                  <Text style={styles.financeLbl}>Debt</Text>
                </View>
                <View style={styles.financeStat}>
                  <Text style={styles.financeVal}>{est.savings ? '~' : ''}{fmtMoney(fin.savings)}</Text>
                  <Text style={styles.financeLbl}>Savings</Text>
                </View>
              </View>
              {anyEst && <Text style={styles.estFootnote}>~ estimated from your profile — roast to refine</Text>}
            </View>
          </ReAnimated.View>
        )}

        {/* Check-in nudge — renders itself only when a check-in is due */}
        <ReAnimated.View entering={enterUp(4)}>
          <CheckinCard onPress={() => navigation.navigate('MonthlyCheckIn')} style={{ marginBottom: Spacing.lg }} />
        </ReAnimated.View>

        {/* Bento row: a wider Trend tile + a Roasts-count stat tile (varied weights) */}
        <ReAnimated.View entering={enterUp(5)} style={styles.bentoRow}>
          <PressableScale haptic="light" onPress={() => navigation.navigate('History')} style={[styles.bentoTile, styles.trendTile]}>
            <View style={styles.tileHeader}>
              <Text style={styles.tileLabel}>Trend</Text>
              <ChevronRightIcon size={16} color={Colors.textSecondary} />
            </View>
            <Svg width={SPARK_W} height={SPARK_H}>
              <Polyline points={points} fill="none" stroke={band.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            </Svg>
            <View style={styles.trendNums}>
              <Text style={styles.trendEnd}>{series[0]}</Text>
              <ArrowLongRightIcon size={16} color={Colors.textSecondary} />
              <Text style={[styles.trendEnd, { color: band.color }]}>{series[series.length - 1]}</Text>
            </View>
          </PressableScale>
          <PressableScale haptic="light" onPress={() => navigation.navigate('AllAnalyses')} style={[styles.bentoTile, styles.statTile]}>
            <View style={styles.tileHeader}>
              <Text style={styles.tileLabel}>Roasts</Text>
              <ChevronRightIcon size={16} color={Colors.textSecondary} />
            </View>
            <Text style={styles.tileStat}>{history.length}</Text>
            <Text style={styles.tileSub}>so far</Text>
          </PressableScale>
        </ReAnimated.View>

        {/* Premium card */}
        <ReAnimated.View entering={enterUp(6)}>
        {tier === 'deep_dive' ? (
          <PressableScale haptic="light" onPress={() => navigation.navigate('Tools')} style={styles.toolsCard}>
            <View style={styles.toolsIcon}><WrenchScrewdriverIcon size={18} color={Colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.toolsTitleRow}>
                <Text style={styles.toolsTitle}>Your plan & tools</Text>
                {planStale && <StaleBadge label="Update" />}
              </View>
              <Text style={styles.toolsSub}>Action plan · debt payoff · scenarios</Text>
            </View>
            <ChevronRightIcon size={18} color={Colors.textSecondary} />
          </PressableScale>
        ) : (
          <PremiumCard
            variant={tier === 'action_plan' ? 'upgrade' : 'go'}
            onPress={() => navigation.navigate('Paywall')}
            style={{ marginBottom: Spacing.lg }}
          />
        )}
        </ReAnimated.View>
      </ScrollView>
    </View>
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
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg },
  greeting: { flex: 1, marginRight: Spacing.md },
  greetingLead: { fontFamily: Typography.fonts.headingMed, fontSize: Typography.title3.fontSize, color: Colors.textSecondary, letterSpacing: -0.3 },
  greetingName: { ...Typography.screenTitle, fontFamily: Typography.fonts.heading, color: Colors.textPrimary },
  hero: { alignItems: 'center', marginBottom: Spacing.xl },
  // Empty-state hero (first run)
  emptyHero: { alignItems: 'center', marginTop: Spacing.xxl, marginBottom: Spacing.xl },
  emptyTitle: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.xl },
  emptySub: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 21, paddingHorizontal: Spacing.lg },
  heroMeta: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  deltaText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize },
  checkedDate: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  // Your-finances snapshot card
  financeCard: { ...card, padding: Spacing.lg, marginBottom: Spacing.lg },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  financeStat: { flex: 1 },
  financeVal: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, letterSpacing: -0.5 },
  financeLbl: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  estFootnote: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, marginTop: Spacing.sm, fontStyle: 'italic' },
  // Stale-state
  staleBanner: { ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, marginBottom: Spacing.lg },
  refreshCta: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, color: Colors.accent },
  toolsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trendNums: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trendEnd: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textSecondary },
  // Bento tiles (varied-weight 2-col row)
  bentoRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  bentoTile: { ...card, padding: Spacing.lg },
  trendTile: { flex: 1.4, justifyContent: 'space-between' },
  statTile: { flex: 1, justifyContent: 'space-between' },
  tileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  tileLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  tileStat: { fontFamily: Typography.fonts.heading, fontSize: 40, color: Colors.textPrimary, letterSpacing: -1.5, marginTop: Spacing.xs },
  tileSub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  toolsCard: { ...card, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.lg },
  toolsIcon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.accentContainer, alignItems: 'center', justifyContent: 'center' },
  toolsTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  toolsSub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
});
