import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Alert, LayoutAnimation,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ShareIcon, ArrowRightOnRectangleIcon, GlobeAltIcon, CalendarIcon, CheckCircleIcon,
  ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, LockClosedIcon, ArrowRightIcon,
} from 'react-native-heroicons/outline';
import { CheckCircleIcon as CheckCircleSolid, XCircleIcon as XCircleSolid } from 'react-native-heroicons/solid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import GlassCard from '@/components/GlassCard';
import ScoreRing from '@/components/ScoreRing';
import StatusPill from '@/components/StatusPill';
import SeverityPill from '@/components/SeverityPill';
import ConfidenceBadge, { confidenceLevel } from '@/components/ConfidenceBadge';
import SectionLabel from '@/components/SectionLabel';
import NeonButton from '@/components/NeonButton';
import { PressableScale, useReducedMotion } from '@/components/motion';
import Disclaimer from '@/components/Disclaimer';
import { GlassSection } from '@/components/iOS/GlassSection';
import ScreenBackground from '@/components/ScreenBackground';
import RoastLoading from '@/components/RoastLoading';
import { MOCK_ANIMATION, MOCK_ANIMATION_MS } from '@/config/ai';
import Toast from '@/components/Toast';

import { useAuth } from '@/context/AuthContext';
import { saveAnalysis } from '@/services/analyses';
import { updateSnapshotFromAnalysis } from '@/services/financialSnapshot';
import { shareToFeed } from '@/services/community';
import { useSubscription } from '@/hooks/useSubscription';
import { trackSnapshotGenerated, trackRoastGenerated, trackFunnelStep } from '@/services/analytics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Results'>;
  route: RouteProp<RootStackParamList, 'Results'>;
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

import { formatCurrency as fmt } from '@/utils/format';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type SpendIcon = { lib: 'ion'; name: IoniconsName } | { lib: 'mci'; name: MCIName };

// Map a free-text spending category to a recognizable icon by keyword; anything
// we don't recognize falls back to a generic tag. Order matters (first match wins).
// Most icons are Ionicons; a few (e.g. fuel) come from MaterialCommunityIcons.
function spendingIcon(category: string): SpendIcon {
  const c = (category || '').toLowerCase();
  const ion = (name: IoniconsName): SpendIcon => ({ lib: 'ion', name });
  const mci = (name: MCIName): SpendIcon => ({ lib: 'mci', name });
  const rules: [RegExp, SpendIcon][] = [
    [/coffee|starbucks|caf[eé]|latte|dunkin/, ion('cafe-outline')],
    [/grocer|supermarket|whole foods|trader|aldi|costco/, ion('cart-outline')],
    [/food|eat|restaurant|doordash|uber\s?eats|grubhub|takeout|dining|meal|fast.?food/, ion('fast-food-outline')],
    [/rent|housing|mortgage|apartment|landlord/, ion('home-outline')],
    [/gas|fuel|petrol/, mci('gas-station-outline')],
    [/car|auto|uber|lyft|transport|transit|parking|metro|bus|ride/, ion('car-outline')],
    [/subscription|netflix|spotify|hulu|disney|streaming|prime\s?video|youtube/, ion('tv-outline')],
    [/gym|fitness|workout|peloton|yoga/, ion('barbell-outline')],
    [/shop|amazon|clothes|clothing|retail|store|target|mall|fashion/, ion('bag-handle-outline')],
    [/phone|internet|wifi|utilit|electric|water|cable|bill/, ion('flash-outline')],
    [/health|medical|doctor|pharmacy|insurance|dental|therapy/, ion('medkit-outline')],
    [/travel|flight|hotel|vacation|airbnb|trip/, ion('airplane-outline')],
    [/game|gaming|xbox|playstation|steam|nintendo/, ion('game-controller-outline')],
    [/drink|bar|alcohol|beer|wine|liquor/, ion('beer-outline')],
    [/pet|dog|cat|vet/, ion('paw-outline')],
    [/movie|concert|event|entertain|cinema|ticket/, ion('film-outline')],
    [/save|saving|invest|401k|roth/, ion('wallet-outline')],
  ];
  for (const [re, ic] of rules) if (re.test(c)) return ic;
  return ion('pricetag-outline');
}

// Renders the right icon family for a spending category.
function SpendingIcon({ category, size, color }: { category: string; size: number; color: string }) {
  const ic = spendingIcon(category);
  return ic.lib === 'mci'
    ? <MaterialCommunityIcons name={ic.name} size={size} color={color} style={styles.metricIcon} />
    : <Ionicons name={ic.name} size={size} color={color} style={styles.metricIcon} />;
}

// A compact icon-button for the secondary actions row (Heroicons UI chrome).
function IconAction({ Icon, label, onPress, tint = Colors.accent }: { Icon: React.ComponentType<any>; label: string; onPress: () => void; tint?: string }) {
  return (
    <PressableScale style={iaStyles.btn} onPress={onPress} haptic="light">
      <View style={[iaStyles.badge, { backgroundColor: Colors.accentContainer }]}>
        <Icon size={20} color={tint} />
      </View>
      <Text style={iaStyles.label}>{label}</Text>
    </PressableScale>
  );
}

export default function ResultsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { analysis, userInput } = route.params;
  const tone = (route.params as any).tone || 'savage';
  // Set when VIEWING a saved roast (History/AllAnalyses/Dashboard) → this screen is read-only:
  // no re-save (no duplicate row) and no snapshot re-merge (no clobbering newer data).
  const viewingId = (route.params as any).analysisId as string | undefined;
  const { user } = useAuth();
  const { hasAccess } = useSubscription();
  const reduce = useReducedMotion();
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [shared, setShared] = useState(false);
  const [mockAnimating, setMockAnimating] = useState(MOCK_ANIMATION && !!viewingId); // dev: replay the roast animation when opening a past roast
  // Progressive disclosure: lead with the hit (score/roast/#1 fix/CTA); the full
  // report stays one tap away so the screen doesn't read as a homework packet.
  const [expanded, setExpanded] = useState(false);
  const toggleBreakdown = () => {
    if (!reduce) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  useEffect(() => {
    trackSnapshotGenerated(analysis.score, analysis.scoreLabel, tone, userInput.length);
    trackRoastGenerated(tone, analysis.roast.length);
    trackFunnelStep('results_viewed', { score: analysis.score });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (viewingId) {
      // Read-only view of an existing roast — adopt its id (so Share works), persist nothing.
      setAnalysisId(viewingId);
      return;
    }
    // New roast → save it; only merge the snapshot once it actually persisted (atomicity — so the
    // score never moves without a roast on record). Surface the real DB error (no Metro console here).
    saveAnalysis(user.id, userInput, analysis)
      .then((res) => {
        setAnalysisId(res.id);
        if (!res.id) {
          setSaveFailed(true);
          Alert.alert("Couldn't save this roast", res.error ?? "Unknown error. Your score won't update until this saves.");
          return;
        }
        updateSnapshotFromAnalysis(user.id, analysis).catch((e) => console.warn('[snapshot] roast merge failed:', e));
      })
      .catch((e) => { setSaveFailed(true); Alert.alert("Couldn't save this roast", String(e)); });
  }, [user, userInput, analysis, viewingId]);

  // Dev viewing aid (MOCK only): when opening a PAST roast, replay the roast animation for a fixed
  // beat so it can be reviewed — mocks make this near-instant otherwise. Never runs in prod.
  useEffect(() => {
    if (!mockAnimating) return;
    const t = setTimeout(() => setMockAnimating(false), MOCK_ANIMATION_MS);
    return () => clearTimeout(t);
  }, []);

  const postToFeed = async () => {
    if (!user || !analysisId) return;
    const id = await shareToFeed(user.id, analysisId, analysis.score, analysis.scoreLabel, analysis.roast, analysis.summary);
    if (id) {
      setShared(true);
      Alert.alert('Shared!', 'Your roast is now live in the Community Feed.', [{ text: 'OK' }]);
    } else {
      Alert.alert('Error', 'Failed to share to feed.');
    }
  };

  // Posting to the public feed is attributable (your @handle) — confirm first.
  const handleShareToFeed = () => {
    if (!user || !analysisId) return;
    Alert.alert(
      'Post to the Community Feed?',
      'Your roast goes public under your @handle — other members can see it. (We never show your exact income or debts.)',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Post publicly', onPress: postToFeed },
      ],
    );
  };

  const scoreColor = analysis.scoreColor ?? getScoreBand(analysis.score).color;
  const canDeepDive = hasAccess('deep_dive');
  const hasDebt = (analysis.debtTotal ?? 0) > 0;

  // Key metrics — vector icons, "N/A" rows hidden so it never looks unfinished.
  const income = analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0;
  const expenses = analysis.monthlyExpenses?.value ?? analysis.monthlyExpenses ?? 0;
  const allMetrics: { label: string; value: string; icon: IoniconsName; highlight?: boolean }[] = [
    { label: 'Monthly Income', value: fmt(income), icon: 'cash-outline' },
    { label: 'Monthly Expenses', value: fmt(expenses), icon: 'card-outline' },
    { label: 'Liquid Savings', value: fmt(analysis.liquidSavings?.value ?? analysis.liquidSavings ?? 0), icon: 'wallet-outline' },
    { label: 'Monthly Savings', value: fmt(analysis.monthlySavings ?? 0), icon: 'save-outline', highlight: (analysis.monthlySavings ?? 0) < 0 },
    { label: 'Total Debt', value: fmt(analysis.debtTotal ?? 0), icon: 'trending-down-outline', highlight: (analysis.debtTotal ?? 0) > 0 },
    { label: 'Savings Rate', value: analysis.savingsRate != null ? `${Math.round(analysis.savingsRate * 100)}%` : 'N/A', icon: 'trending-up-outline' },
    { label: 'Emergency Fund', value: analysis.emergencyFundMonths != null ? `${analysis.emergencyFundMonths.toFixed(1)} mo` : 'N/A', icon: 'shield-checkmark-outline' },
    { label: 'Debt-to-Income', value: analysis.debtToIncomeRatio != null ? `${(analysis.debtToIncomeRatio * 100).toFixed(0)}%` : 'N/A', icon: 'pie-chart-outline' },
    { label: 'Monthly Debt Service', value: fmt(analysis.monthlyDebtService ?? 0), icon: 'calendar-outline' },
  ];
  const metrics = allMetrics.filter((m) => m.value !== 'N/A');

  if (mockAnimating) {
    return (
      <View style={styles.container}>
        <ScreenBackground variant="results" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><RoastLoading /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenBackground variant="results" />
      <Animated.ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score hero — score + /100 inside the ring; band + data confidence beside it */}
        <GlassSection delay={0}>
          <View style={styles.scoreHero}>
            <ScoreRing score={analysis.score} size={140} showOutOf reveal />
            <View style={styles.scoreInfo}>
              <StatusPill label={analysis.scoreLabel} color={scoreColor} size="md" />
              {analysis.avgConfidence > 0 && (
                <View style={styles.confidenceSlot}>
                  <SectionLabel style={styles.confidenceLabel}>Data Confidence</SectionLabel>
                  <ConfidenceBadge level={confidenceLevel(analysis.avgConfidence)} size="md" />
                </View>
              )}
            </View>
          </View>
        </GlassSection>

        {/* TODO(redesign Phase 2): confetti burst when a *good* score lands (e.g.
            score >= 70), synced to the ScoreRing reveal completion. Stubbed for now —
            needs react-native-fast-confetti (Skia dep), deferred to keep the slice
            dependency-light. */}

        {/* Roast */}
        <GlassSection delay={120}>
          <Text style={styles.roastLabel}>Roast</Text>
          <LinearGradient
            colors={[Colors.accentContainer, 'transparent']}
            style={styles.roastCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.roastText}>"{analysis.roast}"</Text>
          </LinearGradient>
        </GlassSection>

        {/* #1 Thing To Fix — the single most actionable line, part of the hit */}
        {analysis.topFix && (
          <>
            <SectionLabel>#1 Thing To Fix</SectionLabel>
            <GlassCard style={styles.topFixCard}>
              <Text style={styles.topFixAction}>{analysis.topFix.action}</Text>
              <Text style={styles.topFixImpact}>
                Est. monthly improvement: {fmt(analysis.topFix.monthlyImpact)}
              </Text>
            </GlassCard>
          </>
        )}

        {/* Lead with the action — Plan CTA + share/track — before the deep report */}
        <View style={styles.actionsGroup}>
          {hasAccess('action_plan') ? (
            <NeonButton
              label="View 90-Day Action Plan"
              onPress={async () => {
                const { fetchOrGenerateActionPlan } = await import('@/services/ai');
                const plan = analysisId ? await fetchOrGenerateActionPlan(analysis, tone, analysisId) : null;
                navigation.navigate('ActionPlan', { steps: (plan?.steps ?? []) as any, analysis, overallMessage: plan?.overallMessage, analysisId: analysisId ?? undefined });
              }}
            />
          ) : (
            <NeonButton
              label="Unlock 90-Day Action Plan — $4.99"
              onPress={() => navigation.navigate('Paywall')}
            />
          )}

          <View style={styles.iconRow}>
            <IconAction Icon={ShareIcon} label="Share" onPress={() => navigation.navigate('Share', { analysis })} />
            {!user ? (
              <IconAction Icon={ArrowRightOnRectangleIcon} label="Sign in" onPress={() => navigation.navigate('Login')} />
            ) : !shared ? (
              <IconAction Icon={GlobeAltIcon} label="Post" onPress={handleShareToFeed} />
            ) : (
              <IconAction Icon={CheckCircleIcon} label="Posted" tint={Colors.success} onPress={() => navigation.navigate('MainTabs', { screen: 'Community' })} />
            )}
            {user && (
              <IconAction Icon={CalendarIcon} label="Track" onPress={() => navigation.navigate('MonthlyCheckIn', { setup: true })} />
            )}
          </View>
        </View>

        {/* Progressive disclosure — the full report is one tap away */}
        <PressableScale style={styles.expandToggle} onPress={toggleBreakdown} haptic="light">
          <Text style={styles.expandToggleText}>{expanded ? 'Hide the full breakdown' : 'See the full breakdown'}</Text>
          {expanded ? <ChevronUpIcon size={18} color={Colors.accent} /> : <ChevronDownIcon size={18} color={Colors.accent} />}
        </PressableScale>

        {expanded && (
          <View>
            {/* The breakdown (summary) */}
            <SectionLabel>The Breakdown</SectionLabel>
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryText}>{analysis.summary}</Text>
            </GlassCard>

        {/* Key metrics */}
        <SectionLabel>Key Metrics</SectionLabel>
        <View style={styles.metricsGroup}>
          {metrics.map((m, i) => (
            <React.Fragment key={m.label}>
              <View style={styles.metricRow}>
                <Ionicons name={m.icon} size={18} color={Colors.textSecondary} style={styles.metricIcon} />
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text style={[styles.metricValue, m.highlight && { color: Colors.danger }]}>{m.value}</Text>
              </View>
              {i < metrics.length - 1 && <View style={styles.rowSep} />}
            </React.Fragment>
          ))}
        </View>

        {/* Emotional status (AI-provided emoji is content, kept as-is) */}
        {analysis.emotionalStatus && (
          <>
            <SectionLabel>Emotional Status</SectionLabel>
            <GlassCard style={styles.emotionCard}>
              <Text style={styles.emotionEmoji}>{analysis.emotionalStatus.emoji}</Text>
              <Text style={styles.emotionText}>{analysis.emotionalStatus.label}</Text>
            </GlassCard>
          </>
        )}

        {/* Score adjustment */}
        {analysis.scoreModifierReason && (
          <>
            <SectionLabel>Score Adjustment</SectionLabel>
            <GlassCard style={styles.modifierCard}>
              <Text style={styles.modifierText}>{analysis.scoreModifierReason}</Text>
            </GlassCard>
          </>
        )}

        {/* What you're doing right */}
        {analysis.positiveBehaviors && analysis.positiveBehaviors.length > 0 && (
          <>
            <SectionLabel>What You're Doing Right</SectionLabel>
            <View style={styles.listCard}>
              {analysis.positiveBehaviors.map((pb, i, arr) => (
                <React.Fragment key={i}>
                  <View style={styles.listRow}>
                    <CheckCircleSolid size={18} color={Colors.success} style={styles.bullet} />
                    <Text style={styles.listText}>{pb}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.rowSep} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* Biggest problems */}
        {analysis.topProblems && analysis.topProblems.length > 0 && (
          <>
            <SectionLabel>Biggest Problems</SectionLabel>
            <View style={styles.listCard}>
              {analysis.topProblems.map((p, i, arr) => (
                <React.Fragment key={i}>
                  <View style={styles.listRow}>
                    <XCircleSolid size={18} color={Colors.danger} style={styles.bullet} />
                    <Text style={styles.listText}>{p}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.rowSep} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* Debts */}
        {analysis.debts && analysis.debts.length > 0 && (
          <>
            <SectionLabel>Debts</SectionLabel>
            <GlassCard style={styles.debtsCard}>
            <View style={styles.debtsHeader}>
              <Text style={styles.debtsTitle}>{analysis.debts.length} {analysis.debts.length === 1 ? 'Debt' : 'Debts'}</Text>
              <Text style={styles.debtsTotal}>{fmt(analysis.debtTotal ?? 0)} total</Text>
            </View>
            {analysis.debts.slice(0, 3).map((d: any) => (
              <View key={d.name} style={styles.debtMiniRow}>
                <Text style={styles.debtMiniName}>{d.name}</Text>
                <SeverityPill level={d.urgency} />
              </View>
            ))}
            {analysis.debts.length > 3 && (
              <Text style={styles.debtsMore}>+{analysis.debts.length - 3} more</Text>
            )}
            {hasDebt && (
              canDeepDive ? (
                <NeonButton
                  label="View Debt Payoff Plan"
                  onPress={() => navigation.navigate('DebtPayoff')}
                  variant="secondary"
                  style={styles.debtsCta}
                />
              ) : (
                <PressableScale style={styles.lockedCta} onPress={() => navigation.navigate('Paywall')} haptic="light">
                  <LockClosedIcon size={16} color={Colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockedCtaTitle}>Upgrade to Deep Dive</Text>
                    <Text style={styles.lockedCtaSub}>Unlock your full debt payoff plan</Text>
                  </View>
                  <ChevronRightIcon size={16} color={Colors.textSecondary} />
                </PressableScale>
              )
            )}
            </GlassCard>
          </>
        )}

        {/* What you mentioned spending */}
        {analysis.mentionedSpending && analysis.mentionedSpending.length > 0 && (
          <>
            <SectionLabel>What You Mentioned Spending</SectionLabel>
            <View style={styles.metricsGroup}>
              {analysis.mentionedSpending.map((item: any, i: number, arr: any[]) => (
                <React.Fragment key={item.category}>
                  <View style={styles.metricRow}>
                    <SpendingIcon category={item.category} size={18} color={Colors.textSecondary} />
                    <Text style={styles.metricLabel}>{item.category}</Text>
                    <Text style={styles.metricValue}>{item.amount ? fmt(item.amount) : 'mentioned'}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.rowSep} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* Recommended budget (50/30/20) */}
        <SectionLabel>Recommended Budget</SectionLabel>
        <View style={styles.metricsGroup}>
          {(() => {
            const savings = analysis.monthlySavings ?? 0;
            const needsPct = income > 0 ? (expenses / income) * 100 : 0;
            const wantsPct = income > 0 ? Math.max(0, ((income - expenses - savings) / income) * 100) : 0;
            const savingsPct = income > 0 ? (savings / income) * 100 : 0;
            const rows: { icon: IoniconsName; label: string; pct: number; current: number; target: number; targetPct: number; danger?: boolean }[] = [
              { icon: 'home-outline', label: 'Needs', pct: needsPct, current: expenses, target: income * 0.5, targetPct: 50 },
              { icon: 'game-controller-outline', label: 'Wants', pct: wantsPct, current: Math.max(0, income - expenses - savings), target: income * 0.3, targetPct: 30 },
              { icon: 'wallet-outline', label: 'Savings / Debt', pct: savingsPct, current: savings, target: income * 0.2, targetPct: 20, danger: savingsPct < 20 },
            ];
            return rows.map((r, i) => (
              <React.Fragment key={r.label}>
                <View style={styles.metricRow}>
                  <Ionicons name={r.icon} size={18} color={Colors.textSecondary} style={styles.metricIcon} />
                  <Text style={styles.metricLabel}>{r.label}</Text>
                  <Text style={[styles.metricValue, r.danger && { color: Colors.danger }]}>{r.pct.toFixed(0)}%</Text>
                </View>
                {income > 0 && (
                  <View style={styles.budgetDetail}>
                    <Text style={styles.budgetDetailText}>Current: {fmt(r.current)}/mo</Text>
                    <Text style={styles.budgetDetailText}>Target: {fmt(r.target)}/mo ({r.targetPct}%)</Text>
                  </View>
                )}
                {i < rows.length - 1 && <View style={styles.rowSep} />}
              </React.Fragment>
            ));
          })()}
        </View>

        {/* Key insights */}
        {analysis.insights?.length > 0 && (
          <>
            <SectionLabel>Key Insights</SectionLabel>
            <View style={styles.listCard}>
              {analysis.insights.map((insight, i, arr) => (
                <React.Fragment key={i}>
                  <View style={styles.listRow}>
                    <ArrowRightIcon size={16} color={Colors.accent} style={styles.bullet} />
                    <Text style={styles.listText}>{insight}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.rowSep} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

          </View>
        )}

        <Disclaimer style={{ marginTop: Spacing.xl }} />
      </Animated.ScrollView>
      <Toast
        visible={saveFailed}
        emoji="⚠️"
        message="Couldn't save this roast — sharing and your plan may be unavailable."
        duration={3500}
        onHide={() => setSaveFailed(false)}
      />
    </View>
  );
}

const iaStyles = StyleSheet.create({
  btn: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  badge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  scoreHero: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  scoreInfo: { flex: 1, gap: Spacing.md },
  confidenceSlot: { gap: Spacing.xs, alignItems: 'flex-start' },
  confidenceLabel: { marginBottom: 0 },
  roastCard: {
    borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.xxl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  roastLabel: {
    fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize,
    color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  // The roast is the personality — give it real presence (oversized, tight).
  roastText: {
    fontFamily: Typography.fonts.headingMed,
    fontSize: 23, color: Colors.textPrimary, lineHeight: 31, letterSpacing: -0.4,
  },
  summaryCard: { padding: Spacing.lg, marginBottom: Spacing.xxl },
  summaryText: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, lineHeight: 22 },
  metricsGroup: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xxl,
  },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: Spacing.rowHeight },
  metricIcon: { marginRight: Spacing.xs },
  metricLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  metricValue: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.lg + 22 },
  // Carded lists (positives / problems / insights) — consistent with the metric groups.
  listCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xxl,
  },
  listRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  bullet: { marginTop: 1 },
  listText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  emotionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.xxl },
  emotionEmoji: { fontSize: Typography.title2.fontSize },
  emotionText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  modifierCard: { padding: Spacing.md, marginBottom: Spacing.xxl },
  modifierText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  topFixCard: { padding: Spacing.lg, marginBottom: Spacing.xxl, borderLeftWidth: 3, borderLeftColor: Colors.tertiarySolid },
  topFixAction: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.xs },
  topFixImpact: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.success },
  debtsCard: { padding: Spacing.lg, marginBottom: Spacing.xxl },
  debtsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  debtsTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  debtsTotal: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  debtMiniRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  debtMiniName: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary, flex: 1 },
  debtsMore: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted, marginTop: Spacing.xs },
  debtsCta: { marginTop: Spacing.md },
  lockedCta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.backgroundSecondary,
  },
  lockedCtaTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.accent },
  lockedCtaSub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 1 },
  budgetDetail: { paddingLeft: Spacing.lg, paddingBottom: Spacing.sm, gap: 1 },
  budgetDetailText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, lineHeight: 17 },
  actionsGroup: { gap: Spacing.lg, marginTop: Spacing.xs },
  iconRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  expandToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  expandToggleText: {
    fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize,
    color: Colors.accent, letterSpacing: -0.2,
  },
});
