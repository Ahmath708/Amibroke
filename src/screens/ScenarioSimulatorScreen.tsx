import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, FinancialAnalysis } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { calculateFinancialScore } from '@/services/scoring';
import GlassCard from '@/components/GlassCard';
import NeonButton from '@/components/NeonButton';
import LoadingState from '@/components/LoadingState';
import ScoreRing from '@/components/ScoreRing';
import { getPurchaseTier, hasAccessTo } from '@/services/purchases';
import { getAnalysisHistory } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'ScenarioSimulator'> };

interface ScenarioConfig {
  id: string;
  title: string;
  emoji: string;
  prompt: string;
  incomeDelta: number;
  expenseDelta: number;
  debtDelta: number;
}

const SCENARIOS: ScenarioConfig[] = [
  { id: '1', title: 'Job Loss', emoji: '😱', prompt: 'I just lost my job. What\'s my financial runway?', incomeDelta: -5000, expenseDelta: 0, debtDelta: 0 },
  { id: '2', title: 'New Baby', emoji: '👶', prompt: 'I\'m expecting a baby in 6 months. How will my finances change?', incomeDelta: 0, expenseDelta: 1500, debtDelta: 0 },
  { id: '3', title: 'Buy a Home', emoji: '🏠', prompt: 'I want to buy a $350k home in 3 years. What do I need to do?', incomeDelta: 0, expenseDelta: 500, debtDelta: 250000 },
  { id: '4', title: 'Pay Off Debt', emoji: '💳', prompt: 'I want to be completely debt-free in 2 years. Is that realistic?', incomeDelta: 0, expenseDelta: -200, debtDelta: -10000 },
  { id: '5', title: 'Start a Business', emoji: '🚀', prompt: 'I want to quit my job and start a business. Can I afford it?', incomeDelta: -3000, expenseDelta: -500, debtDelta: 0 },
  { id: '6', title: 'Early Retirement', emoji: '🌴', prompt: 'I want to retire at 45. What do I need to change now?', incomeDelta: 2000, expenseDelta: -1000, debtDelta: 0 },
];

export default function ScenarioSimulatorScreen({ navigation, route }: Props & { route?: RouteProp<RootStackParamList, 'ScenarioSimulator'> }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [baseAnalysis, setBaseAnalysis] = useState<FinancialAnalysis | null>(null);

  useEffect(() => {
    (async () => {
      const tier = await getPurchaseTier();
      if (hasAccessTo(tier, 'deep_dive')) {
        setAuthorized(true);
      } else {
        navigation.replace('Paywall');
      }

      if (user) {
        const history = await getAnalysisHistory(user.id);
        if (history && history.length > 0) {
          const latest = history[0];
          setBaseAnalysis({
            score: latest.score,
            scoreLabel: latest.score_label,
            scoreColor: latest.score < 40 ? '#ff453a' : latest.score < 65 ? '#ff6b00' : '#39FF14',
            summary: latest.summary,
            roast: '',
            monthlyIncome: 5000,
            monthlyExpenses: 3500,
            monthlySavings: 1500,
            debtTotal: 15000,
            savingsRate: 0.05,
            emergencyFundMonths: 1.5,
            debtToIncomeRatio: 15000 / (5000 * 12),
            spendingBreakdown: [
              { name: 'Housing', amount: 1400, percentage: 0.28, color: '#00e0ff', status: 'good' },
              { name: 'Food', amount: 600, percentage: 0.12, color: '#39FF14', status: 'warning' },
              { name: 'Transport', amount: 400, percentage: 0.08, color: '#bf5af2', status: 'good' },
            ],
            debts: [],
            actionPlan: [],
            insights: [],
          });
        }
      }

      setLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingState />;
  if (!authorized) return null;

  const income = baseAnalysis?.monthlyIncome || 5000;
  const expenses = baseAnalysis?.monthlyExpenses || 3500;
  const debt = baseAnalysis?.debtTotal || 15000;
  const savingsRate = baseAnalysis?.savingsRate || 0.05;
  const emergencyFund = baseAnalysis?.emergencyFundMonths || 1.5;
  const breakdown = baseAnalysis?.spendingBreakdown || [
    { name: 'Housing', amount: 1400, percentage: 0.28 },
    { name: 'Food', amount: 600, percentage: 0.12 },
    { name: 'Transport', amount: 400, percentage: 0.08 },
  ];

  const currentBaseScore = calculateFinancialScore({
    monthlyIncome: income,
    monthlyExpenses: expenses,
    monthlySavings: income - expenses,
    debtTotal: debt,
    savingsRate,
    emergencyFundMonths: emergencyFund,
    debtToIncomeRatio: debt / (income * 12),
    spendingBreakdown: breakdown,
  });

  const handleScenarioSelect = (id: string) => {
    setSelected(selected === id ? null : id);
    setCustom('');
  };

  const handleRun = () => {
    const preset = SCENARIOS.find((p) => p.id === selected);
    const input = custom.trim() || preset?.prompt || '';
    if (input) navigation.navigate('Processing', { userInput: input });
  };

  const scenario = selected ? SCENARIOS.find((s) => s.id === selected) : null;
  const projectedScore = scenario
    ? calculateFinancialScore({
        monthlyIncome: Math.max(0, income + scenario.incomeDelta),
        monthlyExpenses: Math.max(0, expenses + scenario.expenseDelta),
        monthlySavings: Math.max(0, income + scenario.incomeDelta - (expenses + scenario.expenseDelta)),
        debtTotal: Math.max(0, debt + scenario.debtDelta),
        savingsRate: Math.max(0, (income + scenario.incomeDelta - expenses - scenario.expenseDelta) / (income + scenario.incomeDelta || 1)),
        emergencyFundMonths: emergencyFund,
        debtToIncomeRatio: (debt + scenario.debtDelta) / ((income + scenario.incomeDelta) * 12 || 1),
        spendingBreakdown: breakdown,
      })
    : null;

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          See how life changes would impact your financial health in real time.
        </Text>

        {/* Real-time score preview */}
        <GlassCard style={styles.scorePreview}>
          <View style={styles.scorePreviewRow}>
            <ScoreRing score={projectedScore ? projectedScore.score : currentBaseScore.score} size={80} />
            <View style={styles.scorePreviewInfo}>
              <Text style={styles.scorePreviewLabel}>
                {selected ? 'Projected Score' : 'Current Baseline'}
              </Text>
              <Text style={styles.scorePreviewValue}>
                {projectedScore ? projectedScore.score : currentBaseScore.score}
                <Text style={styles.scorePreviewOf}>/100</Text>
              </Text>
              <Text style={[styles.scorePreviewStatus, { color: projectedScore?.color || currentBaseScore.color }]}>
                {projectedScore ? projectedScore.label : currentBaseScore.label}
              </Text>
              {selected && currentBaseScore.score !== projectedScore?.score && (
                <Text style={[
                  styles.scorePreviewDelta,
                  { color: (projectedScore?.score || 0) > currentBaseScore.score ? Colors.success : Colors.danger },
                ]}>
                  {(projectedScore?.score || 0) - currentBaseScore.score > 0 ? '+' : ''}
                  {(projectedScore?.score || 0) - currentBaseScore.score} pts
                </Text>
              )}
            </View>
          </View>
        </GlassCard>

        {/* Preset scenarios */}
        <Text style={styles.sectionLabel}>What-If Scenarios</Text>
        <View style={styles.presetGrid}>
          {SCENARIOS.map((s) => {
            const isActive = selected === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.presetCard, isActive && styles.presetCardActive]}
                onPress={() => handleScenarioSelect(s.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.presetEmoji}>{s.emoji}</Text>
                <Text style={[styles.presetTitle, isActive && styles.presetTitleActive]}>
                  {s.title}
                </Text>
                {isActive && (
                  <Text style={styles.presetDelta}>
                    {s.incomeDelta !== 0 ? `Income: ${s.incomeDelta > 0 ? '+' : ''}$${Math.abs(s.incomeDelta).toLocaleString()}` : ''}
                    {s.expenseDelta !== 0 ? ` | Expenses: ${s.expenseDelta > 0 ? '+' : ''}$${Math.abs(s.expenseDelta).toLocaleString()}` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom input */}
        <Text style={styles.sectionLabel}>Or Describe Your Scenario</Text>
        <GlassCard variant="inset" style={styles.inputCard}>
          <TextInput
            style={styles.customInput}
            placeholder="e.g. I'm thinking of buying a car for $30k — what happens to my finances?"
            placeholderTextColor={Colors.textMuted}
            multiline
            value={custom}
            onChangeText={(t) => { setCustom(t); setSelected(null); }}
            textAlignVertical="top"
          />
        </GlassCard>

        {/* Selected preview */}
        {selected && !custom && (
          <GlassCard style={styles.previewCard}>
            <Text style={styles.previewLabel}>Scenario prompt</Text>
            <Text style={styles.previewText}>"{SCENARIOS.find((s) => s.id === selected)?.prompt}"</Text>
          </GlassCard>
        )}

        <NeonButton
          label="Run Full Analysis"
          onPress={handleRun}
          disabled={!selected && !custom.trim()}
          style={styles.cta}
          icon="⚡"
        />
        <Text style={styles.ctaHint}>Uses your stored financial profile · Score shown is an estimate</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  intro: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  scorePreview: { padding: Spacing.lg, marginBottom: Spacing.xl },
  scorePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  scorePreviewInfo: { flex: 1, gap: Spacing.xs },
  scorePreviewLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  scorePreviewValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.textPrimary },
  scorePreviewOf: { fontSize: Typography.subhead.fontSize, color: Colors.textMuted, fontWeight: '400' },
  scorePreviewStatus: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize },
  scorePreviewDelta: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.subhead.fontSize, fontWeight: '600' },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.md,
  },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxl },
  presetCard: {
    width: '47%', backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
  },
  presetCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  presetEmoji: { fontSize: Typography.title1.fontSize },
  presetTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center' },
  presetTitleActive: { color: Colors.primary, fontFamily: Typography.fonts.bodySemi },
  presetDelta: { fontFamily: Typography.fonts.body, fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },
  inputCard: { padding: Spacing.md, marginBottom: Spacing.md },
  customInput: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary,
    minHeight: 90, lineHeight: 23,
  },
  previewCard: { padding: Spacing.md, marginBottom: Spacing.xl },
  previewLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 20 },
  cta: { marginBottom: Spacing.sm },
  ctaHint: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted, textAlign: 'center' },
});
