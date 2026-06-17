import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { PressableScale, enterUp } from '@/components/motion';
import {
  ChevronRightIcon, ArrowLongRightIcon, ArrowPathIcon,
} from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useScrollToTopFast } from '@/hooks/useScrollToTopFast';
import { AnalysisHistoryItem, TabScreenNav, RoastTone, FinancialAnalysis } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand, type ScoreBand } from '@shared/scoring/bands.ts';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { getAnalysisHistory, getAnalysisById } from '@/services/analyses';
import { getProfile } from '@/services/profile';
import { getSnapshot, buildRescoreInput } from '@/services/financialSnapshot';
import { isSnapshotStaleSince, type FinancialSnapshot } from '@shared/financialSnapshot';
import { getActivePlan, type ActivePlan } from '@/services/activePlan';
import { FEATURES } from '@/config/features';
import { capitalize } from '@/utils/string';
import { formatCompactCurrency } from '@/utils/format';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import ScreenBackground from '@/components/ScreenBackground';
import ScoreRing from '@/components/ScoreRing';
import NeonButton from '@/components/NeonButton';
import Skeleton from '@/components/Skeleton';
import Sparkline from '@/components/Sparkline';
import TopScrim from '@/components/TopScrim';

type Props = { navigation: TabScreenNav<'Home'> };

// Time-of-day greeting for the home header (warmer than a static wordmark).
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Neutral status pill with a glowing band-colored dot (Claude Design `.score-status`).
function ScoreStatusPill({ band }: { band: ScoreBand }) {
  return (
    <View style={styles.statusPill}>
      <View style={[styles.statusDot, { backgroundColor: band.color, shadowColor: band.color }]} />
      <Text style={styles.statusLabel}>{band.label}</Text>
    </View>
  );
}

// One "Financial Reality" metric (colored dot + label + mono value + foot).
function Metric({ color, label, value, foot, onPress }: {
  color: string; label: string; value: string; foot: string; onPress: () => void;
}) {
  return (
    <PressableScale haptic="light" onPress={onPress} style={styles.metric}>
      <View style={styles.mTop}>
        <View style={[styles.mDot, { backgroundColor: color, shadowColor: color }]} />
        <Text style={styles.mLabel}>{label}</Text>
      </View>
      <Text style={styles.mValue} numberOfLines={1}>{value}</Text>
      <Text style={[styles.mFoot, { color }]} numberOfLines={1}>{foot}</Text>
    </PressableScale>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const onScroll = useScrollToTopFast(scrollRef); // re-tap the active tab → scroll to top (snappy)
  const { user } = useAuth();
  const { canUseApp, hasAccess } = useSubscription();
  const { streak } = useCheckinStatus();

  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<FinancialAnalysis | null>(null);
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
      // Prefetch the latest full analysis so we can surface the roast on Home and open
      // Results instantly (no second fetch on tap). Fail-soft → fall back to the summary.
      const latestId = hist?.[0]?.id;
      if (latestId) {
        try { setLatestAnalysis(await getAnalysisById(latestId)); } catch { /* keep null */ }
      } else {
        setLatestAnalysis(null);
      }
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

  // Open the latest roast's Results (gauge + "Read Full Roast"). Use the prefetched analysis;
  // refetch only if it's missing.
  const openLatest = useCallback(async () => {
    const id = history[0]?.id;
    if (!id || opening) return;
    if (latestAnalysis) { (navigation.navigate as any)('Results', { analysis: latestAnalysis, userInput: '', analysisId: id }); return; }
    setOpening(true);
    try {
      const analysis = await getAnalysisById(id);
      if (analysis) (navigation.navigate as any)('Results', { analysis, userInput: '', analysisId: id });
    } catch {
      // ignore
    } finally {
      setOpening(false);
    }
  }, [history, latestAnalysis, opening, navigation]);

  // Snapshot-driven re-score: reconstruct the input (no re-typing), run analyze. Paywall-gated
  // like any roast — expired-free users land on the Paywall, exactly as if they tried to roast.
  const onRescore = useCallback(async () => {
    if (!user) return;
    if (FEATURES.PAYWALL_ENFORCEMENT && !canUseApp) { (navigation.navigate as any)('Paywall'); return; }
    const input = await buildRescoreInput(user.id, history[0]?.id);
    if (input) (navigation.navigate as any)('Processing', { userInput: input, tone });
  }, [user, canUseApp, navigation, tone, history]);

  // Open the action plan: ActionPlan fetches the active plan itself, so when one exists we just
  // navigate; with no plan yet we pass the latest analysis so it can generate one.
  const openPlan = useCallback(async () => {
    if (!hasAccess('action_plan')) { (navigation.navigate as any)('Paywall'); return; }
    if (plan) { (navigation.navigate as any)('ActionPlan', { analysisId: history[0]?.id }); return; }
    const a = history[0] ? await getAnalysisById(history[0].id) : null;
    (navigation.navigate as any)('ActionPlan', { analysis: a, analysisId: history[0]?.id });
  }, [hasAccess, plan, history, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="home" />
        <View style={[styles.scroll, { paddingTop: insets.top + Spacing.xxl }]}>
          <View style={styles.header}>
            <View style={styles.greeting}>
              <Skeleton width={110} height={13} style={{ marginBottom: Spacing.sm }} />
              <Skeleton width={150} height={26} radius={9} />
            </View>
            <Skeleton width={130} height={34} radius={17} />
          </View>
          <View style={{ alignItems: 'center', marginTop: Spacing.xxl }}>
            <Skeleton width={184} height={184} radius={92} />
            <Skeleton width={110} height={28} radius={14} style={{ marginTop: Spacing.lg }} />
          </View>
          <Skeleton width="100%" height={150} radius={16} style={{ marginTop: Spacing.xxl }} />
        </View>
        <TopScrim variant="home" />
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
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
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
          </ReAnimated.View>

          <ReAnimated.View entering={enterUp(1)} style={styles.emptyHero}>
            {snapshot?.score != null ? (
              // Onboarding seeded a starting score (an estimate from the profile) — show it, not "?".
              <>
                <ScoreRing score={snapshot.score} size={150} showOutOf glow />
                <Text style={styles.emptyTitle}>Your starting score</Text>
                <Text style={styles.emptySub}>An estimate from your profile. Run your first roast to make it real — with the breakdown and plan.</Text>
              </>
            ) : (
              <>
                <ScoreRing score={0} size={150} showOutOf empty />
                <Text style={styles.emptyTitle}>Your score is waiting</Text>
                <Text style={styles.emptySub}>Run your first roast to unlock your score, breakdown, and plan.</Text>
              </>
            )}
          </ReAnimated.View>

          <ReAnimated.View entering={enterUp(2)}>
            <NeonButton label="Start your first roast" onPress={() => (navigation.navigate as any)('Analyze')} />
          </ReAnimated.View>
        </ScrollView>
        <TopScrim variant="home" />
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
    expenses: snapshot?.monthlyExpenses?.value ?? 0,
  };
  const hasFinances = fin.income > 0 || fin.debt > 0 || fin.savings > 0;
  // Provenance: brackets from onboarding read 'estimated' until a roast pins them (debt is never
  // bracket-seeded, so it's always real). Flag estimated figures with a "~".
  const est = {
    income: snapshot?.monthlyIncome?.confidence === 'estimated',
    savings: snapshot?.liquidSavings?.confidence === 'estimated',
  };
  const monthlySavings = snapshot?.monthlySavings ?? (fin.income > 0 && fin.expenses > 0 ? fin.income - fin.expenses : 0);
  const debtCount = snapshot?.debts?.value?.length ?? 0;

  // Stale-state: the score is stale when ANY roast-input field changed (check-in, edit, …) since the
  // latest roast — timing-safe via per-field provenance (the roast's own merge is excluded).
  const scoreStale = !!latest && !!snapshot && isSnapshotStaleSince(snapshot, latest.created_at);

  // Chronological scores for the sparkline (oldest → newest), last 8.
  const series = [...history].slice(0, 8).reverse().map((h) => h.score);

  // The roast jab (from the prefetched latest analysis), with a graceful fallback to the summary.
  const roastText = latestAnalysis?.roast || latest.summary || '';

  // "Up Next" — the plan's focal step, or a build/unlock prompt (three states).
  const planAccess = hasAccess('action_plan');
  const nextStep = plan?.steps.find((s) => s.status === 'pending')?.title ?? null;
  const upNext = !planAccess
    ? { emo: '🔒', kicker: 'Get Started', title: 'Unlock your 90-day plan' }
    : plan
      ? (nextStep
          ? { emo: '👉', kicker: 'Up Next', title: nextStep }
          : { emo: '🎉', kicker: 'Plan Complete', title: 'Review your plan' })
      : { emo: '✨', kicker: 'Get Started', title: 'Build your 90-day plan' };

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
        {/* Header: time-aware greeting + a streak pill (Claude Design home header) */}
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
          {streak > 0 && (
            <View style={styles.streakPill}>
              <Text style={styles.streakEmo}>🔥</Text>
              <Text style={styles.streakText}>{streak}-month streak</Text>
            </View>
          )}
        </ReAnimated.View>

        {/* Score hero — focal glow; tap to reopen your latest roast */}
        <ReAnimated.View entering={enterUp(1)}>
          <PressableScale style={styles.hero} onPress={openLatest} haptic="light" disabled={opening}>
            <ScoreRing score={latest.score} size={156} showOutOf glow />
            <ScoreStatusPill band={band} />
            {scoreStale && (
              <PressableScale onPress={onRescore} haptic="light" style={styles.staleChip}>
                <Text style={styles.staleText}>Score may be out of date</Text>
                <ArrowPathIcon size={12} color={Colors.accent} />
                <Text style={styles.staleRefresh}>Refresh</Text>
              </PressableScale>
            )}
          </PressableScale>
        </ReAnimated.View>

        {/* Latest roast blockquote → Results */}
        <ReAnimated.View entering={enterUp(2)}>
          <PressableScale onPress={openLatest} haptic="light" style={styles.roastCard} disabled={opening}>
            <Text style={styles.qmark}>&rdquo;</Text>
            <Text style={styles.roastText} numberOfLines={6}>{roastText}</Text>
            <View style={styles.roastMore}>
              <Text style={styles.roastMoreText}>Read Full Roast</Text>
              <ChevronRightIcon size={13} color={Colors.accentSolid} />
            </View>
          </PressableScale>
        </ReAnimated.View>

        {/* Up Next — the plan's focal step (or build/unlock prompt) */}
        <ReAnimated.View entering={enterUp(3)}>
          <PressableScale onPress={openPlan} haptic="light" style={styles.nextStep}>
            <View style={styles.nsEmo}><Text style={styles.nsEmoText}>{upNext.emo}</Text></View>
            <View style={styles.nsBody}>
              <Text style={styles.nsKicker}>{upNext.kicker}</Text>
              <Text style={styles.nsTitle} numberOfLines={2}>{upNext.title}</Text>
            </View>
            <ChevronRightIcon size={18} color={Colors.textTertiary} />
          </PressableScale>
        </ReAnimated.View>

        {/* Financial Reality — a glance at the snapshot; tiles open the Financials tab */}
        {hasFinances && (
          <ReAnimated.View entering={enterUp(4)}>
            <View style={styles.secLabel}>
              <Text style={styles.secLabelText}>Financial Reality</Text>
              <Text style={styles.secLabelSub}>this month</Text>
            </View>
            <View style={styles.snapshot}>
              <Metric
                color={Colors.success}
                label="Income"
                value={(est.income ? '~' : '') + formatCompactCurrency(fin.income)}
                foot={est.income ? '~ estimated' : '▲ steady'}
                onPress={() => navigation.navigate('Financials')}
              />
              <Metric
                color={Colors.danger}
                label="Debt"
                value={formatCompactCurrency(fin.debt)}
                foot={debtCount === 1 ? 'last debt' : debtCount > 1 ? `${debtCount} debts` : 'owed'}
                onPress={() => navigation.navigate('Financials')}
              />
              <Metric
                color={Colors.secondary}
                label="Savings"
                value={(est.savings ? '~' : '') + formatCompactCurrency(fin.savings)}
                foot={est.savings ? '~ estimated' : monthlySavings > 0 ? '▲ building' : 'balance'}
                onPress={() => navigation.navigate('Financials')}
              />
            </View>
          </ReAnimated.View>
        )}

        {/* History & Trends: a wider Trend tile + a Roasts-count stat tile */}
        <ReAnimated.View entering={enterUp(5)}>
          <View style={styles.secLabel}>
            <Text style={styles.secLabelText}>History &amp; Trends</Text>
          </View>
          <View style={styles.trends}>
            <PressableScale haptic="light" onPress={() => navigation.navigate('History')} style={[styles.tcard, styles.trendTile]}>
              <View style={styles.tHead}>
                <Text style={styles.tTitle}>Score Trend</Text>
                <ChevronRightIcon size={15} color={Colors.textTertiary} />
              </View>
              <Sparkline values={series} color={band.color} />
              {delta != null && delta !== 0 ? (
                <Text style={styles.tDelta}>{delta > 0 ? '+' : '−'}{Math.abs(delta)} pts since last</Text>
              ) : (
                <View style={styles.trendNums}>
                  <Text style={styles.trendEnd}>{series[0]}</Text>
                  <ArrowLongRightIcon size={16} color={Colors.textSecondary} />
                  <Text style={[styles.trendEnd, { color: band.color }]}>{series[series.length - 1]}</Text>
                </View>
              )}
            </PressableScale>
            <PressableScale haptic="light" onPress={() => navigation.navigate('History')} style={[styles.tcard, styles.statTile]}>
              <View style={styles.tHead}>
                <Text style={styles.tTitle}>Past Roasts</Text>
                <ChevronRightIcon size={15} color={Colors.textTertiary} />
              </View>
              <Text style={styles.roastsNum}>{history.length}</Text>
              <Text style={styles.roastsSub}>brutal reviews</Text>
            </PressableScale>
          </View>
        </ReAnimated.View>

      </ScrollView>
      <TopScrim variant="home" />
    </View>
  );
}

const card = {
  backgroundColor: Colors.backgroundSecondary,
  borderRadius: Radius.xl,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: Colors.glassBorder,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.sm },
  greeting: { flex: 1, marginRight: Spacing.md, gap: Spacing.xs },
  greetingLead: { fontFamily: Typography.fonts.headingMed, fontSize: 13, color: Colors.textSecondary, letterSpacing: -0.1 },
  greetingName: { fontFamily: Typography.fonts.extrabold, fontSize: 23, letterSpacing: -0.8, color: Colors.textPrimary },
  // Streak pill (top-right)
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    paddingVertical: 7, paddingLeft: 10, paddingRight: 12, borderRadius: Radius.pill,
    backgroundColor: Colors.accentContainer, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder,
  },
  streakEmo: { fontSize: 12.5 },
  streakText: { fontFamily: Typography.fonts.bodySemi, fontSize: 12, color: Colors.accent, letterSpacing: -0.1 },

  // Score hero
  hero: { alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.xl },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: Spacing.md,
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.separator,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  statusLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, color: Colors.textPrimary },
  staleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
  staleText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  staleRefresh: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.accent },

  // Empty-state hero (first run)
  emptyHero: { alignItems: 'center', marginTop: Spacing.xxl, marginBottom: Spacing.xl },
  emptyTitle: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.xl },
  emptySub: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 21, paddingHorizontal: Spacing.lg },

  // Roast blockquote
  roastCard: {
    ...card, borderColor: Colors.glassBorder, borderLeftWidth: 3, borderLeftColor: Colors.accentSolid,
    borderRadius: Radius.xl, paddingVertical: 18, paddingRight: 18, paddingLeft: 20, marginBottom: Spacing.md,
  },
  qmark: { position: 'absolute', top: 6, right: 16, fontSize: 46, lineHeight: 46, fontFamily: Typography.fonts.heading, color: 'rgba(255,0,122,0.18)' },
  roastText: { fontFamily: Typography.fonts.body, fontStyle: 'italic', fontSize: 15.5, lineHeight: 23, color: '#ECECEF', letterSpacing: -0.2, maxWidth: '92%' },
  roastMore: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 13 },
  roastMoreText: { fontFamily: Typography.fonts.bodySemi, fontSize: 12.5, color: Colors.accentSolid },

  // Up Next
  nextStep: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.backgroundTertiary, borderRadius: Radius.xl, paddingVertical: 14, paddingLeft: 16, paddingRight: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight, marginBottom: Spacing.lg,
  },
  nsEmo: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.accentContainer, alignItems: 'center', justifyContent: 'center' },
  nsEmoText: { fontSize: 18 },
  nsBody: { flex: 1 },
  nsKicker: { fontFamily: Typography.fonts.bodySemi, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: Colors.accent },
  nsTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 14.5, color: Colors.textPrimary, marginTop: 3, letterSpacing: -0.2 },

  // Section label
  secLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xl, marginBottom: Spacing.md, marginHorizontal: 2 },
  secLabelText: { fontFamily: Typography.fonts.bodySemi, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.textTertiary },
  secLabelSub: { fontFamily: Typography.fonts.mono, fontSize: 12, color: 'rgba(255,255,255,0.28)' },

  // Financial Reality snapshot (3 metric tiles)
  snapshot: { flexDirection: 'row', gap: Spacing.sm },
  metric: { ...card, flex: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 9, borderRadius: Radius.xl },
  mTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mDot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  mLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.2 },
  mValue: { fontFamily: Typography.fonts.monoSemi, fontSize: 19, color: Colors.textPrimary, letterSpacing: -0.8 },
  mFoot: { fontFamily: Typography.fonts.bodySemi, fontSize: 10.5, letterSpacing: -0.1 },

  // History & Trends (bento row)
  trends: { flexDirection: 'row', gap: Spacing.sm },
  tcard: { ...card, padding: Spacing.lg, borderRadius: Radius.xl },
  trendTile: { flex: 1.25, justifyContent: 'space-between' },
  statTile: { flex: 1, justifyContent: 'space-between' },
  tHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  tTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, color: Colors.textPrimary, letterSpacing: -0.2 },
  tDelta: { fontFamily: Typography.fonts.monoSemi, fontSize: 12, color: Colors.accent, marginTop: 9 },
  trendNums: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 9 },
  trendEnd: { fontFamily: Typography.fonts.monoSemi, fontSize: Typography.title3.fontSize, color: Colors.textSecondary },
  roastsNum: { fontFamily: Typography.fonts.extrabold, fontSize: 40, color: Colors.textPrimary, letterSpacing: -2, marginTop: Spacing.lg },
  roastsSub: { fontFamily: Typography.fonts.bodySemi, fontSize: 11.5, color: Colors.textSecondary, marginTop: 4 },
});
