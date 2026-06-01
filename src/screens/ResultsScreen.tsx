import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import ScoreRing from '@/components/ScoreRing';
import StatusPill from '@/components/StatusPill';
import ConfidenceBadge, { confidenceLevel } from '@/components/ConfidenceBadge';
import NeonButton from '@/components/NeonButton';
import Disclaimer from '@/components/Disclaimer';
import { GlassSection } from '@/components/iOS/GlassSection';
import ScreenBackground from '@/components/ScreenBackground';
import Toast from '@/components/Toast';

import { useAuth } from '@/context/AuthContext';
import { saveAnalysis, shareToFeed } from '@/services/claudeApi';
import { getSubscription, hasAccessTo } from '@/services/subscriptions';
import { trackSnapshotGenerated, trackRoastGenerated, trackFunnelStep } from '@/services/analytics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Results'>;
  route: RouteProp<RootStackParamList, 'Results'>;
};

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function ResultsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { analysis, userInput } = route.params;
  const tone = (route.params as any).tone || 'savage';
  const { user } = useAuth();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [shared, setShared] = useState(false);
  const [purchaseTier, setPurchaseTier] = useState<'free' | 'action_plan' | 'deep_dive'>('free');

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: Spacing.lg * 6.25, useNativeDriver: true }).start();
    trackSnapshotGenerated(analysis.score, analysis.scoreLabel, tone, userInput.length);
    trackRoastGenerated(tone, analysis.roast.length);
    trackFunnelStep('results_viewed', { score: analysis.score });
  }, []);

  useEffect(() => {
    (async () => {
      const { tier } = await getSubscription(user?.id ?? '');
      setPurchaseTier(tier);
    })();
  }, []);

  useEffect(() => {
    if (user) {
      saveAnalysis(user.id, userInput, analysis)
        .then((id) => {
          setAnalysisId(id);
          // saveAnalysis returns null on failure — surface it, since a missing
          // id silently disables sharing and the action plan.
          if (!id) setSaveFailed(true);
        })
        .catch(() => setSaveFailed(true));
    }
  }, [user, userInput, analysis]);

  const handleShareToFeed = async () => {
    if (!user || !analysisId) return;
    const id = await shareToFeed(
      user.id,
      analysisId,
      analysis.score,
      analysis.scoreLabel,
      analysis.roast,
      analysis.summary,
    );
    if (id) {
      setShared(true);
      Alert.alert('Shared!', 'Your roast is now live in the Community Feed.', [{ text: 'OK' }]);
    } else {
      Alert.alert('Error', 'Failed to share to feed.');
    }
  };

  const scoreColor = analysis.scoreColor ?? (
    analysis.score < 40 ? Colors.danger :
    analysis.score < 65 ? Colors.warning : Colors.success);

  const scoreVariant =
    analysis.score < 40 ? 'danger' :
    analysis.score < 65 ? 'warning' : 'good';

  return (
    <View style={styles.container}>
      <ScreenBackground variant="results" />
      <Animated.ScrollView
        style={{ opacity: fadeIn }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score hero */}
        <GlassSection delay={0}>
          <View style={styles.scoreHero}>
            <ScoreRing score={analysis.score} size={140} />
            <View style={styles.scoreInfo}>
              <StatusPill label={analysis.scoreLabel} variant={scoreVariant} size="md" />
              <Text style={styles.scoreNum} adjustsFontSizeToFit numberOfLines={1}>
                {analysis.score}<Text style={styles.scoreOf}>/100</Text>
              </Text>
            </View>
          </View>
        </GlassSection>

        {/* Roast card */}
        <GlassSection delay={120}>
          <LinearGradient
            colors={['rgba(189,0,255,0.2)', 'rgba(231,0,110,0.15)']}
            style={styles.roastCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.roastEmoji}>🔥</Text>
            <Text style={styles.roastText}>"{analysis.roast}"</Text>
          </LinearGradient>
        </GlassSection>

        {/* Summary */}
        <GlassSection delay={220}>
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryText}>{analysis.summary}</Text>
          </GlassCard>
        </GlassSection>

        {/* Key metrics — iOS-style grouped rows */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGroup}>
          {[
            { label: 'Monthly Income', value: fmt(analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0), icon: '💵', confidence: analysis.monthlyIncome?.confidence },
            { label: 'Monthly Expenses', value: fmt(analysis.monthlyExpenses?.value ?? analysis.monthlyExpenses ?? 0), icon: '💸', confidence: analysis.monthlyExpenses?.confidence },
            { label: 'Liquid Savings', value: fmt(analysis.liquidSavings?.value ?? analysis.liquidSavings ?? 0), icon: '🏦', confidence: analysis.liquidSavings?.confidence },
            { label: 'Monthly Savings', value: fmt(analysis.monthlySavings ?? 0), icon: '💰', highlight: (analysis.monthlySavings ?? 0) < 0 },
            { label: 'Total Debt', value: fmt(analysis.debtTotal ?? 0), icon: '📉', highlight: (analysis.debtTotal ?? 0) > 0 },
            { label: 'Savings Rate', value: analysis.savingsRate != null ? `${Math.round(analysis.savingsRate * 100)}%` : 'N/A', icon: '📈' },
            { label: 'Emergency Fund', value: analysis.emergencyFundMonths != null ? `${analysis.emergencyFundMonths.toFixed(1)} mo` : 'N/A', icon: '🛡️' },
            { label: 'Debt-to-Income', value: analysis.debtToIncomeRatio != null ? `${(analysis.debtToIncomeRatio * 100).toFixed(0)}%` : 'N/A', icon: '⚖️' },
            { label: 'Monthly Debt Service', value: fmt(analysis.monthlyDebtService ?? 0), icon: '💳' },
          ].map((m, i, arr) => (
            <React.Fragment key={m.label}>
              <View style={styles.metricRow}>
                <Text style={styles.metricIcon}>{m.icon}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text style={[styles.metricValue, m.highlight && { color: Colors.danger }]}>{m.value}</Text>
                {'confidence' in m && m.confidence && (
                  <View style={styles.confBadgeWrap}>
                    <ConfidenceBadge level={m.confidence as any} />
                  </View>
                )}
              </View>
              {i < arr.length - 1 && <View style={styles.rowSep} />}
            </React.Fragment>
          ))}
        </View>

        {/* Overall data confidence */}
        {analysis.avgConfidence > 0 && (
          <GlassCard style={styles.emotionCard}>
            <Text style={styles.emotionLabel}>Data Confidence</Text>
            <ConfidenceBadge level={confidenceLevel(analysis.avgConfidence)} size="md" />
          </GlassCard>
        )}

        {/* Emotional status */}
        {analysis.emotionalStatus && (
          <GlassCard style={styles.emotionCard}>
            <Text style={styles.emotionEmoji}>{analysis.emotionalStatus.emoji}</Text>
            <View>
              <Text style={styles.emotionLabel}>Emotional Status</Text>
              <Text style={styles.emotionText}>{analysis.emotionalStatus.label}</Text>
            </View>
          </GlassCard>
        )}

        {/* Score modifier reason */}
        {analysis.scoreModifierReason && (
          <GlassCard style={styles.modifierCard}>
            <Text style={styles.modifierLabel}>Score Adjustment</Text>
            <Text style={styles.modifierText}>{analysis.scoreModifierReason}</Text>
          </GlassCard>
        )}

        {/* #1 Thing To Fix */}
        {analysis.topFix && (
          <GlassCard style={styles.topFixCard}>
            <Text style={styles.topFixLabel}>🚨 #1 Thing To Fix</Text>
            <Text style={styles.topFixAction}>{analysis.topFix.action}</Text>
            <Text style={styles.topFixImpact}>
              Estimated monthly improvement: ${analysis.topFix.monthlyImpact.toLocaleString()}
            </Text>
          </GlassCard>
        )}

        {/* Positive behaviors */}
        {analysis.positiveBehaviors && analysis.positiveBehaviors.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>✅ What You're Doing Right</Text>
            <View style={styles.insightsList}>
              {analysis.positiveBehaviors.map((pb, i) => (
                <View key={i} style={styles.insightRow}>
                  <Text style={styles.positiveBullet}>✓</Text>
                  <Text style={styles.positiveText}>{pb}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top problems */}
        {analysis.topProblems && analysis.topProblems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🚩 Biggest Problems</Text>
            <View style={styles.insightsList}>
              {analysis.topProblems.map((p, i) => (
                <View key={i} style={styles.insightRow}>
                  <Text style={styles.problemBullet}>✗</Text>
                  <Text style={styles.problemText}>{p}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Debts summary */}
        {analysis.debts && analysis.debts.length > 0 && (
          <GlassCard style={styles.debtsCard}>
            <View style={styles.debtsHeader}>
              <Text style={styles.debtsTitle}>📋 {analysis.debts.length} {analysis.debts.length === 1 ? 'Debt' : 'Debts'}</Text>
              <Text style={styles.debtsTotal}>{fmt(analysis.debtTotal ?? 0)} total</Text>
            </View>
            {analysis.debts.slice(0, 3).map((d: any) => (
              <View key={d.name} style={styles.debtMiniRow}>
                <Text style={styles.debtMiniName}>{d.name}</Text>
                <Text style={[styles.debtMiniUrgency, { color: d.urgency === 'critical' ? Colors.danger : d.urgency === 'high' ? Colors.warning : Colors.textSecondary }]}>{d.urgency}</Text>
              </View>
            ))}
            {analysis.debts.length > 3 && (
              <Text style={styles.debtsMore}>+{analysis.debts.length - 3} more</Text>
            )}
            {(analysis.debtTotal ?? 0) > 0 && hasAccessTo(purchaseTier, 'deep_dive') && (
              <NeonButton
                label="Full Debt Payoff Plan"
                onPress={() => navigation.navigate('DebtPayoff', { debts: analysis.debts ?? [], monthlyIncome: analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0 })}
                variant="secondary"
                style={styles.debtsCta}
              />
            )}
          </GlassCard>
        )}

        {/* What you mentioned spending */}
        {analysis.mentionedSpending && analysis.mentionedSpending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>What You Mentioned Spending</Text>
            <View style={styles.metricsGroup}>
              {analysis.mentionedSpending.map((item: any, i: number, arr: any[]) => (
                <React.Fragment key={item.category}>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricIcon}>💳</Text>
                    <Text style={styles.metricLabel}>{item.category}</Text>
                    <Text style={styles.metricValue}>{item.amount ? `$${item.amount.toLocaleString()}` : 'mentioned'}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.rowSep} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* Recommended Budget */}
        <Text style={styles.sectionTitle}>Recommended Budget</Text>
        <View style={styles.metricsGroup}>
          {(() => {
            const income = analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0;
            const expenses = analysis.monthlyExpenses?.value ?? analysis.monthlyExpenses ?? 0;
            const savings = analysis.monthlySavings ?? 0;
            const needsPct = income > 0 ? (expenses / income) * 100 : 0;
            const wantsPct = income > 0 ? Math.max(0, ((income - expenses - savings) / income) * 100) : 0;
            const savingsPct = income > 0 ? (savings / income) * 100 : 0;
            const recNeeds = income * 0.5;
            const recWants = income * 0.3;
            const recSavings = income * 0.2;
            return (
              <>
                <View style={styles.metricRow}>
                  <Text style={styles.metricIcon}>🏠</Text>
                  <Text style={styles.metricLabel}>Needs</Text>
                  <Text style={styles.metricValue}>{needsPct.toFixed(0)}%</Text>
                </View>
                {income > 0 && (
                  <View style={styles.budgetDetail}>
                    <Text style={styles.budgetDetailText}>
                      Current: ${expenses.toLocaleString()}/mo
                    </Text>
                    <Text style={styles.budgetDetailText}>
                      Target: ${recNeeds.toLocaleString()}/mo (50%)
                    </Text>
                  </View>
                )}
                <View style={styles.rowSep} />
                <View style={styles.metricRow}>
                  <Text style={styles.metricIcon}>🎮</Text>
                  <Text style={styles.metricLabel}>Wants</Text>
                  <Text style={styles.metricValue}>{wantsPct.toFixed(0)}%</Text>
                </View>
                {income > 0 && (
                  <View style={styles.budgetDetail}>
                    <Text style={styles.budgetDetailText}>
                      Current: ${Math.max(0, income - expenses - savings).toLocaleString()}/mo
                    </Text>
                    <Text style={styles.budgetDetailText}>
                      Target: ${recWants.toLocaleString()}/mo (30%)
                    </Text>
                  </View>
                )}
                <View style={styles.rowSep} />
                <View style={styles.metricRow}>
                  <Text style={styles.metricIcon}>💰</Text>
                  <Text style={styles.metricLabel}>Savings / Debt</Text>
                  <Text style={[styles.metricValue, savingsPct < 20 && { color: Colors.danger }]}>{savingsPct.toFixed(0)}%</Text>
                </View>
                {income > 0 && (
                  <View style={styles.budgetDetail}>
                    <Text style={styles.budgetDetailText}>
                      Current: ${savings.toLocaleString()}/mo
                    </Text>
                    <Text style={styles.budgetDetailText}>
                      Target: ${recSavings.toLocaleString()}/mo (20%)
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Insights */}
        {analysis.insights?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Key Insights</Text>
            <View style={styles.insightsList}>
              {analysis.insights.map((insight, i) => (
                <View key={i} style={styles.insightRow}>
                  <Text style={styles.insightBullet}>→</Text>
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Actions */}
        <View style={styles.actionsGroup}>
          {hasAccessTo(purchaseTier, 'action_plan') ? (
            <NeonButton
              label="View 90-Day Action Plan"
              onPress={async () => {
                const { fetchOrGenerateActionPlan } = await import('@/services/claudeApi');
                const plan = analysisId ? await fetchOrGenerateActionPlan(analysis, tone, analysisId) : null;
                navigation.navigate('ActionPlan', { steps: (plan?.steps ?? []) as any, analysis, overallMessage: plan?.overallMessage });
              }}
              style={styles.actionBtn}
            />
          ) : (
            <NeonButton
              label="Unlock 90-Day Action Plan — $4.99"
              onPress={() => navigation.navigate('Paywall')}
              style={styles.actionBtn}
              variant="secondary"
            />
          )}
          {(analysis.debtTotal ?? 0) > 0 && hasAccessTo(purchaseTier, 'deep_dive') && (
            <NeonButton
              label="Debt Payoff Calculator"
              onPress={() => navigation.navigate('DebtPayoff', { debts: analysis.debts ?? [], monthlyIncome: analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0 })}
              variant="secondary"
              style={styles.actionBtn}
            />
          )}
          <NeonButton
            label="Share My Score"
            onPress={() => navigation.navigate('Share', { analysis })}
            variant="tinted"
            style={styles.actionBtn}
            icon="📤"
          />
          {!user ? (
            <NeonButton
              label="Sign in to Share to Community"
              onPress={() => navigation.navigate('Login')}
              variant="secondary"
              style={styles.actionBtn}
              icon="🔑"
            />
          ) : !shared ? (
            <NeonButton
              label="+ Share to Community Feed"
              onPress={handleShareToFeed}
              variant="secondary"
              style={styles.actionBtn}
              icon="🌐"
            />
          ) : (
            <NeonButton
              label="✓ Shared to Community Feed"
              onPress={() => navigation.navigate('MainTabs', { screen: 'Community' })}
              variant="tinted"
              style={styles.actionBtn}
            />
          )}
        </View>

        <Disclaimer style={{ marginTop: Spacing.xl }} />
      </Animated.ScrollView>
      <Toast
        visible={saveFailed}
        emoji="⚠️"
        message="Couldn't save this analysis — sharing and your plan may be unavailable."
        duration={3500}
        onHide={() => setSaveFailed(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  scoreHero: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  scoreInfo: { flex: 1, gap: Spacing.sm },
scoreNum: {
  fontFamily: Typography.fonts.heading,
  fontSize: Typography.title1.fontSize, fontWeight: '700',
  color: Colors.textPrimary, letterSpacing: -2,
},
  scoreOf: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '400' },
  roastCard: {
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
  },
  roastEmoji: { fontSize: Typography.title3.fontSize, marginTop: Spacing.xs },
  roastText: {
    flex: 1, fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 22,
  },
  summaryCard: { padding: Spacing.lg, marginBottom: Spacing.xxl },
  summaryText: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, lineHeight: 22 },
  sectionTitle: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.sm, marginTop: Spacing.xs,
  },
  metricsGroup: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.xxl,
  },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: Spacing.rowHeight },
  metricIcon: { fontSize: Typography.body.fontSize, marginRight: Spacing.sm },
  metricLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  metricValue: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 46 },
  breakdownCard: { overflow: 'hidden', marginBottom: Spacing.xxl },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  breakdownLeft: { width: 110 },
  breakdownName: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary },
  breakdownPct: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary },
  breakdownBarWrap: { flex: 1, height: 6, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xs, overflow: 'hidden' },
  breakdownBar: { height: '100%', borderRadius: Radius.xs },
  breakdownAmt: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, width: 56, textAlign: 'right' },
  insightsList: { gap: Spacing.sm, marginBottom: Spacing.xxl },
  insightRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  insightBullet: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.primary, marginTop: 1 },
  insightText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  emotionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.md },
  emotionEmoji: { fontSize: Typography.title2.fontSize },
  emotionLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  emotionText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, marginTop: 2 },
  topFixCard: { padding: Spacing.lg, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.tertiarySolid },
  modifierCard: { padding: Spacing.md, marginBottom: Spacing.md },
  modifierLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  modifierText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  debtsCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  debtsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  debtsTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  debtsTotal: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  debtMiniRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  debtMiniName: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary, flex: 1 },
  debtMiniUrgency: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, textTransform: 'capitalize' },
  debtsMore: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted, marginTop: Spacing.xs },
  debtsCta: { marginTop: Spacing.sm },
  confBadgeWrap: { marginLeft: 6 },
  topFixLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, color: Colors.tertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  topFixAction: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.xs },
  topFixImpact: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.success },
  positiveBullet: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.success, marginTop: 1 },
  positiveText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  problemBullet: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.danger, marginTop: 1 },
  problemText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  actionsGroup: { gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: {},
  budgetDetail: { paddingLeft: Spacing.xl + Spacing.sm, paddingBottom: Spacing.xs },
  budgetDetailText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, lineHeight: 16 },
});
