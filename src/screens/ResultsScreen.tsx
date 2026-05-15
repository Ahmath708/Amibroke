import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import GlassCard from '../components/GlassCard';
import ScoreRing from '../components/ScoreRing';
import StatusPill from '../components/StatusPill';
import NeonButton from '../components/NeonButton';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Results'>;
  route: RouteProp<RootStackParamList, 'Results'>;
};

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function ResultsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { analysis } = route.params;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const scoreColor =
    analysis.score < 40 ? Colors.danger :
    analysis.score < 65 ? Colors.warning : Colors.success;

  const scoreVariant =
    analysis.score < 40 ? 'danger' :
    analysis.score < 65 ? 'warning' : 'good';

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <Animated.ScrollView
        style={{ opacity: fadeIn }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score hero */}
        <View style={styles.scoreHero}>
          <ScoreRing score={analysis.score} size={140} />
          <View style={styles.scoreInfo}>
            <StatusPill label={analysis.scoreLabel} variant={scoreVariant} size="md" />
            <Text style={styles.scoreNum} adjustsFontSizeToFit numberOfLines={1}>
              {analysis.score}<Text style={styles.scoreOf}>/100</Text>
            </Text>
          </View>
        </View>

        {/* Roast card */}
        <LinearGradient
          colors={['rgba(189,0,255,0.2)', 'rgba(231,0,110,0.15)']}
          style={styles.roastCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={styles.roastEmoji}>🔥</Text>
          <Text style={styles.roastText}>"{analysis.roast}"</Text>
        </LinearGradient>

        {/* Summary */}
        <GlassCard style={styles.summaryCard}>
          <Text style={styles.summaryText}>{analysis.summary}</Text>
        </GlassCard>

        {/* Key metrics — iOS-style grouped rows */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGroup}>
          {[
            { label: 'Monthly Income', value: fmt(analysis.monthlyIncome), icon: '💵' },
            { label: 'Monthly Expenses', value: fmt(analysis.monthlyExpenses), icon: '💸' },
            { label: 'Monthly Savings', value: fmt(analysis.monthlySavings), icon: '🏦', highlight: analysis.monthlySavings < 0 },
            { label: 'Total Debt', value: fmt(analysis.debtTotal), icon: '🏋️', highlight: analysis.debtTotal > 0 },
            { label: 'Savings Rate', value: `${analysis.savingsRate.toFixed(0)}%`, icon: '📊' },
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

        {/* Spending breakdown */}
        {analysis.spendingBreakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Spending Breakdown</Text>
            <GlassCard style={styles.breakdownCard}>
              {analysis.spendingBreakdown.map((cat, i) => (
                <View key={cat.name}>
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <Text style={styles.breakdownName}>{cat.name}</Text>
                      <Text style={styles.breakdownPct}>{cat.percentage.toFixed(0)}%</Text>
                    </View>
                    <View style={styles.breakdownBarWrap}>
                      <View style={[styles.breakdownBar, {
                        width: `${cat.percentage}%`,
                        backgroundColor: cat.status === 'danger' ? Colors.danger : cat.status === 'warning' ? Colors.warning : Colors.success
                      }]} />
                    </View>
                    <Text style={styles.breakdownAmt}>{fmt(cat.amount)}</Text>
                  </View>
                  {i < analysis.spendingBreakdown.length - 1 && <View style={styles.rowSep} />}
                </View>
              ))}
            </GlassCard>
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
          <NeonButton
            label="View 90-Day Action Plan"
            onPress={() => navigation.navigate('ActionPlan', { steps: analysis.actionPlan })}
            style={styles.actionBtn}
          />
          {analysis.debtTotal > 0 && (
            <NeonButton
              label="Debt Payoff Calculator"
              onPress={() => navigation.navigate('DebtPayoff', { debts: analysis.debts, monthlyIncome: analysis.monthlyIncome })}
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
        </View>
      </Animated.ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  scoreHero: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    marginBottom: 20,
  },
  scoreInfo: { flex: 1, gap: 8 },
  scoreNum: {
    fontFamily: Typography.fonts.heading,
    fontSize: 64, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: -2,
  },
  scoreOf: { fontSize: 24, color: Colors.textSecondary, fontWeight: '400' },
  roastCard: {
    borderRadius: Radius.lg, padding: 16, marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  roastEmoji: { fontSize: 20, marginTop: 2 },
  roastText: {
    flex: 1, fontFamily: Typography.fonts.body,
    fontSize: 15, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 22,
  },
  summaryCard: { padding: 16, marginBottom: 24 },
  summaryText: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  sectionTitle: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginTop: 4,
  },
  metricsGroup: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 24,
  },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, minHeight: 48 },
  metricIcon: { fontSize: 17, marginRight: 10 },
  metricLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary },
  metricValue: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textSecondary },
  rowSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 46 },
  breakdownCard: { overflow: 'hidden', marginBottom: 24 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  breakdownLeft: { width: 110 },
  breakdownName: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textPrimary },
  breakdownPct: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textSecondary },
  breakdownBarWrap: { flex: 1, height: 6, backgroundColor: Colors.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  breakdownBar: { height: '100%', borderRadius: 3 },
  breakdownAmt: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary, width: 56, textAlign: 'right' },
  insightsList: { gap: 10, marginBottom: 24 },
  insightRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  insightBullet: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.primary, marginTop: 1 },
  insightText: { flex: 1, fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  actionsGroup: { gap: 10, marginTop: 4 },
  actionBtn: {},
});
