import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ActionStep } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import GlassCard from '../components/GlassCard';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ActionPlan'>;
  route: RouteProp<RootStackParamList, 'ActionPlan'>;
};

const DEFAULT_STEPS: ActionStep[] = [
  { week: 1, title: 'Emergency Fund Start', description: 'Open a high-yield savings account and automate $25/week transfers.', impact: 'Builds safety net', category: 'savings', completed: false },
  { week: 2, title: 'Subscription Purge', description: 'Cancel all subscriptions you haven\'t used in the last 30 days. No mercy.', impact: 'Saves $80–200/mo', category: 'savings', completed: false },
  { week: 3, title: 'Meal Prep Sunday', description: 'Prep 5 weekday lunches each Sunday to cut eating-out spend by 60%.', impact: 'Saves $120–180/mo', category: 'savings', completed: false },
  { week: 4, title: 'Automate Savings', description: 'Set up a recurring transfer on payday so savings happen before you can spend.', impact: 'Increases savings rate', category: 'savings', completed: false },
  { week: 5, title: 'Credit Card Minimum+', description: 'Pay minimums on all cards, plus $50 extra on the highest-rate card.', impact: 'Reduces interest paid', category: 'debt', completed: false },
  { week: 6, title: 'Side Income Session', description: 'Dedicate 4 hours this week to one income-generating activity.', impact: '+$50–200 this week', category: 'income', completed: false },
  { week: 7, title: 'Negotiate Bills', description: 'Call your internet, phone, and insurance providers and ask for a better rate.', impact: 'Saves $30–80/mo', category: 'savings', completed: false },
  { week: 8, title: '30-Day Review', description: 'Run a new analysis and compare to your starting score. Celebrate progress.', impact: 'Accountability boost', category: 'mindset', completed: false },
];

export default function ActionPlanScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const steps = route.params?.steps?.length > 0 ? route.params.steps : DEFAULT_STEPS;
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (week: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  };

  const progress = Math.round((checked.size / steps.length) * 100);

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress summary */}
        <GlassCard style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{checked.size} of {steps.length} complete</Text>
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressSub}>Keep going — consistency beats intensity every time.</Text>
        </GlassCard>

        {/* Steps — iOS grouped list by week */}
        <Text style={styles.sectionLabel}>Weekly Actions</Text>
        <View style={styles.stepGroup}>
          {steps.map((step, i) => {
            const done = checked.has(step.week);
            return (
              <React.Fragment key={step.week}>
                {i > 0 && <View style={styles.stepSep} />}
                <TouchableOpacity
                  style={styles.stepRow}
                  onPress={() => toggle(step.week)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, done && styles.checkboxDone]}>
                    {done && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.stepContent}>
                    <View style={styles.stepHeader}>
                      <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{step.title}</Text>
                      <View style={[styles.weekBadge, done && styles.weekBadgeDone]}>
                        <Text style={[styles.weekText, done && styles.weekTextDone]}>Wk {step.week}</Text>
                      </View>
                    </View>
                    {!done && (
                      <>
                        <Text style={styles.stepDesc}>{step.description}</Text>
                        <View style={styles.impactRow}>
                          <Text style={styles.impactLabel}>Impact:</Text>
                          <Text style={styles.impactValue}>{step.impact}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  progressCard: { padding: 16, marginBottom: 24, gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  progressPct: { fontFamily: Typography.fonts.heading, fontSize: 22, fontWeight: '700', color: Colors.primary },
  progressTrack: { height: 6, backgroundColor: Colors.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  progressSub: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  stepGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  stepSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
  stepRow: { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'flex-start' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.glassBorderLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontSize: 13, color: Colors.background, fontWeight: '700' },
  stepContent: { flex: 1, gap: 4 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stepTitle: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  stepTitleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  weekBadge: {
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  weekBadgeDone: { backgroundColor: Colors.successContainer },
  weekText: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.primary },
  weekTextDone: { color: Colors.success },
  stepDesc: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: 2 },
  impactRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  impactLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, color: Colors.textSecondary },
  impactValue: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, color: Colors.success, fontWeight: '500' },
});
