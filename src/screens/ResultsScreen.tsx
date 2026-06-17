import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Alert, LayoutAnimation,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ShareIcon, ArrowRightOnRectangleIcon, GlobeAltIcon, CalendarIcon, CheckCircleIcon,
  ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, LockClosedIcon, ArrowRightIcon,
  ArrowDownTrayIcon,
} from 'react-native-heroicons/outline';
import {
  CheckCircleIcon as CheckCircleSolid, XCircleIcon as XCircleSolid, BoltIcon,
} from 'react-native-heroicons/solid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import GlassCard from '@/components/GlassCard';
import ScoreRing from '@/components/ScoreRing';
import BandPill from '@/components/BandPill';
import { ListGroup, ListRow } from '@/components/ListGroup';
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
import ConfirmSheet from '@/components/ConfirmSheet';

import { useAuth } from '@/context/AuthContext';
import { saveAnalysis } from '@/services/analyses';
import { updateSnapshotFromAnalysis } from '@/services/financialSnapshot';
import { shareToFeed, unshareFromFeed, isSharedToFeed } from '@/services/community';
import { getActivePlan } from '@/services/activePlan';
import { shareFinancialReportPdf } from '@/services/pdf';
import { useSubscription } from '@/hooks/useSubscription';
import { trackSnapshotGenerated, trackRoastGenerated, trackFunnelStep } from '@/services/analytics';
import { PURCHASE_PRODUCTS } from '@/types';

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

// A small rounded-square icon tile holding the right icon family for a spending category.
function SpendingIconTile({ category }: { category: string }) {
  const ic = spendingIcon(category);
  return (
    <View style={styles.lgIco}>
      {ic.lib === 'mci'
        ? <MaterialCommunityIcons name={ic.name} size={16} color="rgba(255,255,255,0.7)" />
        : <Ionicons name={ic.name} size={16} color="rgba(255,255,255,0.7)" />}
    </View>
  );
}

// A square quick-action tile (icon + label) for the secondary actions row.
function QuickAction({ Icon, label, onPress, tint = Colors.textSecondary }: { Icon: React.ComponentType<any>; label: string; onPress: () => void; tint?: string }) {
  return (
    <PressableScale style={qaStyles.tile} onPress={onPress} haptic="light">
      <Icon size={20} color={tint} />
      <Text style={qaStyles.label}>{label}</Text>
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
  const [postBusy, setPostBusy] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'post' | 'unpost'>('post');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [postToast, setPostToast] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
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

  // Reflect whether THIS roast is already live in the feed (across sessions, not just this view),
  // so the action reads "Posted" and the toggle knows which way it's going.
  useEffect(() => {
    if (!user || !analysisId) return;
    isSharedToFeed(analysisId, user.id).then(setShared).catch(() => {});
  }, [user, analysisId]);

  // The post action is a toggle; both directions get a confirm (posting is public + attributable,
  // un-posting drops the post and its reactions). The ConfirmSheet drives the actual call.
  const openConfirm = (mode: 'post' | 'unpost') => {
    if (!user || !analysisId) return;
    setConfirmMode(mode);
    setConfirmVisible(true);
  };

  const confirmPost = async () => {
    if (!user || !analysisId) return;
    setPostBusy(true);
    const id = await shareToFeed(user.id, analysisId, analysis.score, analysis.scoreLabel, analysis.roast, analysis.summary);
    setPostBusy(false);
    if (id) {
      setShared(true);
      setConfirmVisible(false);
      setPostToast('Posted to the Community Feed');
    } else {
      Alert.alert('Error', 'Failed to share to feed.');
    }
  };

  const confirmUnpost = async () => {
    if (!user || !analysisId) return;
    setPostBusy(true);
    const ok = await unshareFromFeed(analysisId, user.id);
    setPostBusy(false);
    if (ok) {
      setShared(false);
      setConfirmVisible(false);
      setPostToast('Removed from the feed');
    } else {
      Alert.alert('Error', 'Failed to remove from feed.');
    }
  };

  // Deep Dive perk: export the full report as a shareable PDF (Save to Files / Mail / AirDrop).
  // Includes the already-generated active plan if one exists — no LLM call, no cost.
  const handleDownloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const plan = user ? await getActivePlan(user.id) : null;
      await shareFinancialReportPdf(analysis, { plan });
    } catch (e) {
      Alert.alert('Export failed', "We couldn't generate your report. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  const scoreColor = analysis.scoreColor ?? getScoreBand(analysis.score).color;
  const canDeepDive = hasAccess('deep_dive');
  const hasDebt = (analysis.debtTotal ?? 0) > 0;
  const planPrice = PURCHASE_PRODUCTS.action_plan?.price ?? 4.99;
  const deepPrice = PURCHASE_PRODUCTS.deep_dive?.price ?? 9.99;

  // Key metrics — "N/A" rows hidden so it never looks unfinished.
  const income = analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0;
  const expenses = analysis.monthlyExpenses?.value ?? analysis.monthlyExpenses ?? 0;
  const monthlySavings = analysis.monthlySavings ?? 0;
  const allMetrics: { label: string; value: string; color?: string }[] = [
    { label: 'Monthly Income', value: fmt(income) },
    { label: 'Monthly Expenses', value: fmt(expenses) },
    { label: 'Liquid Savings', value: fmt(analysis.liquidSavings?.value ?? analysis.liquidSavings ?? 0) },
    { label: 'Monthly Savings', value: (monthlySavings >= 0 ? '+' : '') + fmt(monthlySavings), color: monthlySavings > 0 ? Colors.success : monthlySavings < 0 ? Colors.danger : undefined },
    { label: 'Total Debt', value: fmt(analysis.debtTotal ?? 0), color: (analysis.debtTotal ?? 0) > 0 ? Colors.danger : undefined },
    { label: 'Savings Rate', value: analysis.savingsRate != null ? `${Math.round(analysis.savingsRate * 100)}%` : 'N/A' },
    { label: 'Emergency Fund', value: analysis.emergencyFundMonths != null ? `${analysis.emergencyFundMonths.toFixed(1)} mo` : 'N/A' },
    { label: 'Debt-to-Income', value: analysis.debtToIncomeRatio != null ? `${(analysis.debtToIncomeRatio * 100).toFixed(0)}%` : 'N/A' },
    { label: 'Monthly Debt Service', value: fmt(analysis.monthlyDebtService ?? 0) },
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
        {/* Score hero — the signature count-up reveal; band pill + data-confidence beside it */}
        <GlassSection delay={0}>
          <View style={styles.scoreHero}>
            <ScoreRing score={analysis.score} size={150} showOutOf reveal />
            <View style={styles.scoreInfo}>
              <BandPill label={analysis.scoreLabel} color={scoreColor} size="md" />
              {analysis.avgConfidence > 0 && (
                <View style={styles.confidenceSlot}>
                  <SectionLabel style={styles.confidenceLabel}>Data Confidence</SectionLabel>
                  <ConfidenceBadge level={confidenceLevel(analysis.avgConfidence)} size="md" />
                </View>
              )}
            </View>
          </View>
        </GlassSection>

        {/* Roast — the personality; oversized + accent-washed */}
        <GlassSection delay={80}>
          <LinearGradient
            colors={[Colors.accentContainer, 'transparent']}
            style={styles.roastCard}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          >
            <Text style={styles.qmark}>&rdquo;</Text>
            <Text style={styles.roastLabel}>Roast</Text>
            <Text style={styles.roastText}>{analysis.roast}</Text>
          </LinearGradient>
        </GlassSection>

        {/* #1 Thing To Fix — the single most actionable line, part of the hit */}
        {analysis.topFix && (
          <GlassSection delay={140}>
            <View style={styles.fixCard}>
              <View style={styles.fixIco}><BoltIcon size={20} color={Colors.success} /></View>
              <View style={styles.fixBody}>
                <Text style={styles.fixLabel}>#1 Thing To Fix</Text>
                <Text style={styles.fixAction}>{analysis.topFix.action}</Text>
                <Text style={styles.fixImpact}>Est. monthly improvement: {fmt(analysis.topFix.monthlyImpact)}</Text>
              </View>
            </View>
          </GlassSection>
        )}

        {/* Lead with the action — Plan CTA + quick actions — before the deep report */}
        <GlassSection delay={200}>
          <View style={styles.actionsGroup}>
            {hasAccess('action_plan') ? (
              <NeonButton
                label="View 90-Day Action Plan"
                glow
                onPress={async () => {
                  const { fetchOrGenerateActionPlan } = await import('@/services/ai');
                  const plan = analysisId ? await fetchOrGenerateActionPlan(analysis, tone, analysisId) : null;
                  navigation.navigate('ActionPlan', { steps: (plan?.steps ?? []) as any, analysis, overallMessage: plan?.overallMessage, analysisId: analysisId ?? undefined });
                }}
              />
            ) : (
              <NeonButton
                label={`Unlock 90-Day Action Plan — $${planPrice}`}
                onPress={() => navigation.navigate('Paywall')}
              />
            )}

            <View style={styles.quickRow}>
              <QuickAction Icon={ShareIcon} label="Share" onPress={() => navigation.navigate('Share', { analysis })} />
              {!user ? (
                <QuickAction Icon={ArrowRightOnRectangleIcon} label="Sign in" onPress={() => navigation.navigate('Login')} />
              ) : shared ? (
                <QuickAction Icon={CheckCircleIcon} label="Posted" tint={Colors.success} onPress={() => openConfirm('unpost')} />
              ) : (
                <QuickAction Icon={GlobeAltIcon} label="Post" onPress={() => openConfirm('post')} />
              )}
              {user && (
                <QuickAction Icon={CalendarIcon} label="Track" onPress={() => navigation.navigate('MonthlyCheckIn', { setup: true })} />
              )}
              {canDeepDive && (
                <QuickAction Icon={ArrowDownTrayIcon} label={pdfBusy ? 'Saving…' : 'PDF'} onPress={handleDownloadPdf} />
              )}
            </View>
          </View>
        </GlassSection>

        {/* Progressive disclosure — the full report is one tap away */}
        <PressableScale style={styles.bdToggle} onPress={toggleBreakdown} haptic="light">
          <View style={styles.bdToggleText}>
            <Text style={styles.bdToggleTitle}>{expanded ? 'Hide the full breakdown' : 'See the full breakdown'}</Text>
            <Text style={styles.bdToggleSub}>{expanded ? 'Tap to hide the homework' : 'Metrics, debts, budget & insights'}</Text>
          </View>
          {expanded ? <ChevronUpIcon size={18} color={Colors.textTertiary} /> : <ChevronDownIcon size={18} color={Colors.textTertiary} />}
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
            <ListGroup style={styles.groupGap}>
              {metrics.map((m) => (
                <ListRow key={m.label} label={m.label} value={m.value} valueColor={m.color} />
              ))}
            </ListGroup>

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
                <View style={styles.markCard}>
                  {analysis.positiveBehaviors.map((pb, i, arr) => (
                    <View key={i} style={[styles.markRow, i < arr.length - 1 && styles.markRowBorder]}>
                      <View style={[styles.markIco, { backgroundColor: Colors.successContainer }]}><CheckCircleSolid size={15} color={Colors.success} /></View>
                      <Text style={styles.markText}>{pb}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Biggest problems */}
            {analysis.topProblems && analysis.topProblems.length > 0 && (
              <>
                <SectionLabel>Biggest Problems</SectionLabel>
                <View style={styles.markCard}>
                  {analysis.topProblems.map((p, i, arr) => (
                    <View key={i} style={[styles.markRow, i < arr.length - 1 && styles.markRowBorder]}>
                      <View style={[styles.markIco, { backgroundColor: Colors.dangerContainer }]}><XCircleSolid size={15} color={Colors.danger} /></View>
                      <Text style={styles.markText}>{p}</Text>
                    </View>
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
                          <Text style={styles.lockedCtaTitle}>Upgrade to Deep Dive — ${deepPrice}</Text>
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
                <ListGroup style={styles.groupGap}>
                  {analysis.mentionedSpending.map((item: any) => (
                    <ListRow
                      key={item.category}
                      label={item.category}
                      value={item.amount ? fmt(item.amount) : 'mentioned'}
                      mono={!!item.amount}
                      left={<SpendingIconTile category={item.category} />}
                    />
                  ))}
                </ListGroup>
              </>
            )}

            {/* Recommended budget (50/30/20) */}
            <SectionLabel>Recommended Budget · 50/30/20</SectionLabel>
            <GlassCard style={styles.budgetCard}>
              {(() => {
                const savings = monthlySavings;
                const wants = Math.max(0, income - expenses - savings);
                const rows: { label: string; targetPct: number; current: number; target: number; over?: boolean; good?: boolean }[] = [
                  { label: 'Needs', targetPct: 50, current: expenses, target: income * 0.5, over: income > 0 && expenses > income * 0.5 },
                  { label: 'Wants', targetPct: 30, current: wants, target: income * 0.3, over: income > 0 && wants > income * 0.3 },
                  { label: 'Savings / Debt', targetPct: 20, current: savings, target: income * 0.2, good: income > 0 && savings >= income * 0.2 },
                ];
                return rows.map((r, i) => {
                  const fillPct = income > 0 ? Math.min(100, Math.max(0, (r.current / income) * 100)) : 0;
                  const youColor = r.good ? Colors.success : r.over ? Colors.danger : Colors.textPrimary;
                  return (
                    <View key={r.label} style={[styles.budRow, i < rows.length - 1 && styles.budRowBorder]}>
                      <View style={styles.budTop}>
                        <Text style={styles.budName}>{r.label} <Text style={styles.budPct}>{r.targetPct}%</Text></Text>
                        <Text style={styles.budNums}>target {fmt(r.target)} · <Text style={{ color: youColor }}>you {fmt(r.current)}</Text></Text>
                      </View>
                      <View style={styles.budTrack}>
                        <View style={[styles.budFill, { width: `${fillPct}%` }]} />
                        <View style={[styles.budTarget, { left: `${r.targetPct}%` }]} />
                      </View>
                    </View>
                  );
                });
              })()}
            </GlassCard>

            {/* Key insights */}
            {analysis.insights?.length > 0 && (
              <>
                <SectionLabel>Key Insights</SectionLabel>
                <View style={styles.markCard}>
                  {analysis.insights.map((insight, i, arr) => (
                    <View key={i} style={[styles.markRow, i < arr.length - 1 && styles.markRowBorder]}>
                      <ArrowRightIcon size={16} color={Colors.accentSolid} style={styles.insightArrow} />
                      <Text style={styles.markText}>{insight}</Text>
                    </View>
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
      <Toast
        visible={!!postToast}
        emoji="✅"
        message={postToast ?? ''}
        duration={2500}
        onHide={() => setPostToast(null)}
      />
      <ConfirmSheet
        visible={confirmVisible}
        onClose={() => { setConfirmVisible(false); }}
        title={confirmMode === 'unpost' ? 'Remove from the feed?' : 'Post to the Community Feed?'}
        message={confirmMode === 'unpost'
          ? 'Your roast and its reactions will be removed from the public feed. You can re-post anytime.'
          : 'Your roast goes public under your @handle — other members can see it. (We never show your exact income or debts.)'}
        confirmLabel={confirmMode === 'unpost' ? 'Remove' : 'Post publicly'}
        destructive={confirmMode === 'unpost'}
        loading={postBusy}
        onConfirm={confirmMode === 'unpost' ? confirmUnpost : confirmPost}
      />
    </View>
  );
}

const qaStyles = StyleSheet.create({
  tile: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, paddingHorizontal: 4, borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  label: { fontFamily: Typography.fonts.bodySemi, fontSize: 11.5, color: Colors.textSecondary, letterSpacing: -0.1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },

  // Score hero
  scoreHero: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: Spacing.xl, marginTop: Spacing.xs },
  scoreInfo: { flex: 1, gap: Spacing.md },
  confidenceSlot: { gap: Spacing.xs, alignItems: 'flex-start' },
  confidenceLabel: { marginBottom: 0 },

  // Roast
  roastCard: {
    borderRadius: Radius.xxl, paddingVertical: 20, paddingHorizontal: 20, marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder, overflow: 'hidden',
  },
  qmark: { position: 'absolute', top: 6, right: 18, fontSize: 60, lineHeight: 60, fontFamily: Typography.fonts.heading, color: 'rgba(255,0,122,0.16)' },
  roastLabel: { fontFamily: Typography.fonts.extrabold, fontSize: 11, color: Colors.accentSolid, textTransform: 'uppercase', letterSpacing: 2, marginBottom: Spacing.md },
  roastText: { fontFamily: Typography.fonts.extrabold, fontSize: 25, color: Colors.textPrimary, lineHeight: 30, letterSpacing: -0.9, maxWidth: '94%' },

  // #1 Thing To Fix
  fixCard: {
    flexDirection: 'row', gap: 13, alignItems: 'flex-start',
    borderRadius: 18, padding: 16, marginBottom: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.success + '4D',
  },
  fixIco: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.successContainer },
  fixBody: { flex: 1 },
  fixLabel: { fontFamily: Typography.fonts.extrabold, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.success, marginBottom: 5 },
  fixAction: { fontFamily: Typography.fonts.bodySemi, fontSize: 16, color: Colors.textPrimary, lineHeight: 21, letterSpacing: -0.3 },
  fixImpact: { fontFamily: Typography.fonts.monoSemi, fontSize: 13, color: Colors.success, marginTop: 9 },

  // Actions
  actionsGroup: { gap: Spacing.md, marginTop: Spacing.xs },
  quickRow: { flexDirection: 'row', gap: 9 },

  // Breakdown toggle
  bdToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md,
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: Radius.xl, marginTop: Spacing.xl, marginBottom: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  bdToggleText: { flex: 1 },
  bdToggleTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.2 },
  bdToggleSub: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, color: Colors.textSecondary, marginTop: 3 },

  groupGap: { marginBottom: Spacing.xxl },

  // The breakdown summary
  summaryCard: { padding: 18, marginBottom: Spacing.xxl, borderRadius: 18 },
  summaryText: { fontFamily: Typography.fonts.body, fontSize: 14.5, color: 'rgba(255,255,255,0.78)', lineHeight: 22 },

  // lg icon tile (mentioned spending)
  lgIco: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder },

  // Emotional status
  emotionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 17, marginBottom: Spacing.xxl, borderRadius: 18 },
  emotionEmoji: { fontSize: 34 },
  emotionText: { fontFamily: Typography.fonts.bodySemi, fontSize: 18, color: Colors.textPrimary, letterSpacing: -0.4 },

  // Score adjustment
  modifierCard: { padding: Spacing.md, marginBottom: Spacing.xxl, borderRadius: 18 },
  modifierText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },

  // mark lists (positives / problems / insights)
  markCard: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: 18, paddingHorizontal: 17, marginBottom: Spacing.xxl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  markRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 11 },
  markRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator },
  markIco: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  markText: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: 'rgba(255,255,255,0.84)', lineHeight: 20, letterSpacing: -0.2 },
  insightArrow: { marginTop: 2 },

  // Debts
  debtsCard: { padding: Spacing.lg, marginBottom: Spacing.xxl, borderRadius: 18 },
  debtsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  debtsTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  debtsTotal: { fontFamily: Typography.fonts.monoSemi, fontSize: 14, color: Colors.textSecondary },
  debtMiniRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  debtMiniName: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary, flex: 1 },
  debtsMore: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted, marginTop: Spacing.xs },
  debtsCta: { marginTop: Spacing.md },
  lockedCta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.backgroundTertiary,
  },
  lockedCtaTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.accent },
  lockedCtaSub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 1 },

  // Recommended budget
  budgetCard: { paddingVertical: 4, paddingHorizontal: 17, marginBottom: Spacing.xxl, borderRadius: 18 },
  budRow: { paddingVertical: 13 },
  budRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator },
  budTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  budName: { fontFamily: Typography.fonts.bodySemi, fontSize: 14, color: Colors.textPrimary },
  budPct: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, color: Colors.textSecondary },
  budNums: { fontFamily: Typography.fonts.mono, fontSize: 12, color: Colors.textSecondary },
  budTrack: { height: 7, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'visible', position: 'relative' },
  budFill: { height: '100%', borderRadius: Radius.pill, backgroundColor: Colors.accentSolid },
  budTarget: { position: 'absolute', top: -1, width: 2, height: 9, backgroundColor: Colors.textPrimary, borderRadius: 1 },
});
