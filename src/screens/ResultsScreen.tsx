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
import NeonButton from '@/components/NeonButton';
import Disclaimer from '@/components/Disclaimer';
import { GlassSection } from '@/components/iOS/GlassSection';
import ScreenBackground from '@/components/ScreenBackground';

import { useAuth } from '@/context/AuthContext';
import { saveAnalysis, shareToFeed } from '@/services/claudeApi';
import { getPurchaseTier, hasAccessTo } from '@/services/purchases';
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
  const [shared, setShared] = useState(false);
  const [purchaseTier, setPurchaseTier] = useState<'free' | 'action_plan' | 'deep_dive'>('free');

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: Spacing.lg * 6.25, useNativeDriver: true }).start();
    trackSnapshotGenerated(analysis.score, analysis.scoreLabel, tone, userInput.length);
    trackRoastGenerated(tone, analysis.roast.length);
    trackFunnelStep('results_viewed', { score: analysis.score });
  }, []);

  useEffect(() => {
    getPurchaseTier().then(setPurchaseTier);
  }, []);

  useEffect(() => {
    if (user) {
      saveAnalysis(user.id, userInput, analysis).then(setAnalysisId).catch(() => console.warn('Failed to save analysis'));
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

  const scoreColor =
    analysis.score < 40 ? Colors.danger :
    analysis.score < 65 ? Colors.warning : Colors.success;

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
            { label: 'Monthly Income', value: fmt(analysis.monthlyIncome.value), icon: '💵' },
            { label: 'Monthly Expenses', value: fmt(analysis.monthlyExpenses.value), icon: '💸' },
            { label: 'Monthly Savings', value: fmt(analysis.monthlySavings), icon: '💰', highlight: analysis.monthlySavings < 0 },
            { label: 'Total Debt', value: fmt(analysis.debtTotal), icon: '📉', highlight: analysis.debtTotal > 0 },
            { label: 'Savings Rate', value: `${analysis.savingsRate.toFixed(0)}%`, icon: '📈' },
            { label: 'Emergency Fund', value: `${analysis.emergencyFundMonths.toFixed(1)} mo`, icon: '🛡️' },
          ].map((m, i, arr) => (
            <React.Fragment key={m.label}>
              <View style={styles.metricRow}>
                <Text style={styles.metricIcon}>{m.icon}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text style={[styles.metricValue, m.highlight && { color: Colors.danger }]}>{m.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.rowSep} />}
            </React.Fragment>
          ))}
        </View>

        {/* Cfpb insight */}
        {analysis.avgConfidence > 0 && (
          <GlassCard style={styles.emotionCard}>
            <Text style={styles.emotionLabel}>Data Confidence</Text>
            <Text style={styles.emotionText}>
              {analysis.avgConfidence >= 0.8 ? 'High' : analysis.avgConfidence >= 0.5 ? 'Medium' : 'Low'}
            </Text>
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

        {/* Insights */}
        {analysis.insights.length > 0 && (
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
                const { fetchActionPlan } = await import('@/services/claudeApi');
                const steps = analysisId ? await fetchActionPlan(user?.id ?? '', analysisId) : [];
                navigation.navigate('ActionPlan', { steps: steps as any });
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
          {analysis.debtTotal > 0 && hasAccessTo(purchaseTier, 'deep_dive') && (
            <NeonButton
              label="Debt Payoff Calculator"
              onPress={() => navigation.navigate('DebtPayoff', { debts: analysis.debts, monthlyIncome: analysis.monthlyIncome.value })}
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
              onPress={() => navigation.navigate('CommunityFeed')}
              variant="tinted"
              style={styles.actionBtn}
            />
          )}
        </View>

        <Disclaimer style={{ marginTop: Spacing.xl }} />
      </Animated.ScrollView>
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
  topFixLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, color: Colors.tertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  topFixAction: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.xs },
  topFixImpact: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.success },
  positiveBullet: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.success, marginTop: 1 },
  positiveText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  problemBullet: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.danger, marginTop: 1 },
  problemText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  actionsGroup: { gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: {},
});
