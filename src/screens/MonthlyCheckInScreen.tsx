import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import NeonButton from '../components/NeonButton';
import GlassCard from '../components/GlassCard';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MonthlyCheckIn'> };

const QUESTIONS = [
  { id: 'income', label: 'Monthly Income', placeholder: '3200', prefix: '$', keyboardType: 'numeric' as const },
  { id: 'expenses', label: 'Total Expenses', placeholder: '2800', prefix: '$', keyboardType: 'numeric' as const },
  { id: 'savings', label: 'Amount Saved', placeholder: '400', prefix: '$', keyboardType: 'numeric' as const },
  { id: 'debt', label: 'Total Debt Balance', placeholder: '8500', prefix: '$', keyboardType: 'numeric' as const },
];

const MOODS = ['😭', '😟', '😐', '🙂', '🤑'];

export default function MonthlyCheckInScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'mood' | 'note'>('form');

  const setAnswer = (id: string, val: string) =>
    setAnswers((prev) => ({ ...prev, [id]: val }));

  const handleSubmit = () => {
    const income = parseFloat(answers.income || '0');
    const expenses = parseFloat(answers.expenses || '0');
    const situationText = `Monthly check-in: income $${income}, expenses $${expenses}, saved $${answers.savings || 0}, total debt $${answers.debt || 0}. Mood: ${mood !== null ? MOODS[mood] : 'not set'}. Note: ${note || 'none'}`;
    navigation.replace('Processing', { userInput: situationText });
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress steps */}
        <View style={styles.stepRow}>
          {(['form', 'mood', 'note'] as const).map((s, i) => (
            <React.Fragment key={s}>
              <View style={[styles.stepDot, step === s && styles.stepDotActive, (step === 'mood' && i === 0) || (step === 'note' && i < 2) ? styles.stepDotDone : null]} />
              {i < 2 && <View style={styles.stepLine} />}
            </React.Fragment>
          ))}
        </View>

        {step === 'form' && (
          <>
            <Text style={styles.stepTitle}>May 2026 Numbers</Text>
            <Text style={styles.stepSubtitle}>Quick snapshot — takes 30 seconds.</Text>

            <Text style={styles.sectionLabel}>This Month's Figures</Text>
            <View style={styles.formGroup}>
              {QUESTIONS.map((q, i) => (
                <React.Fragment key={q.id}>
                  {i > 0 && <View style={styles.cellSep} />}
                  <View style={styles.formCell}>
                    <Text style={styles.formLabel}>{q.label}</Text>
                    <View style={styles.formInputRow}>
                      <Text style={styles.formPrefix}>{q.prefix}</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder={q.placeholder}
                        placeholderTextColor={Colors.textMuted}
                        value={answers[q.id] || ''}
                        onChangeText={(v) => setAnswer(q.id, v)}
                        keyboardType={q.keyboardType}
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* Quick comparison vs last month */}
            <GlassCard style={styles.lastMonthCard}>
              <Text style={styles.lastMonthTitle}>vs. Last Month (April)</Text>
              <View style={styles.lastMonthRow}>
                {[
                  { label: 'Score', last: '38', change: '+4' },
                  { label: 'Income', last: '$3,100', change: '+$100' },
                  { label: 'Saved', last: '$310', change: '+$90' },
                ].map((item) => (
                  <View key={item.label} style={styles.lastMonthItem}>
                    <Text style={styles.lastMonthLabel}>{item.label}</Text>
                    <Text style={styles.lastMonthValue}>{item.last}</Text>
                    <Text style={[styles.lastMonthChange, { color: Colors.success }]}>{item.change}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>

            <NeonButton label="Continue →" onPress={() => setStep('mood')} />
          </>
        )}

        {step === 'mood' && (
          <>
            <Text style={styles.stepTitle}>How are you feeling?</Text>
            <Text style={styles.stepSubtitle}>About your finances this month, honestly.</Text>

            <View style={styles.moodRow}>
              {MOODS.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.moodBtn, mood === i && styles.moodBtnActive]}
                  onPress={() => setMood(i)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {mood !== null && (
              <GlassCard style={styles.moodLabel}>
                <Text style={styles.moodLabelText}>
                  {['Financially Stressed', 'Worried', 'Getting By', 'Feeling Good', 'On Fire 🔥'][mood]}
                </Text>
              </GlassCard>
            )}

            <View style={styles.navButtons}>
              <NeonButton label="← Back" onPress={() => setStep('form')} variant="tinted" style={styles.backBtn} />
              <NeonButton label="Continue →" onPress={() => setStep('note')} style={styles.nextBtn} disabled={mood === null} />
            </View>
          </>
        )}

        {step === 'note' && (
          <>
            <Text style={styles.stepTitle}>Any notes?</Text>
            <Text style={styles.stepSubtitle}>Anything unusual this month? Big expense, income change?</Text>

            <GlassCard variant="inset" style={styles.noteCard}>
              <TextInput
                style={styles.noteInput}
                placeholder={"e.g. \"Had a medical bill this month, also got a $500 bonus at work.\""}
                placeholderTextColor={Colors.textMuted}
                multiline
                value={note}
                onChangeText={setNote}
                textAlignVertical="top"
              />
            </GlassCard>

            <View style={styles.navButtons}>
              <NeonButton label="← Back" onPress={() => setStep('mood')} variant="tinted" style={styles.backBtn} />
              <NeonButton label="Run Analysis ⚡" onPress={handleSubmit} style={styles.nextBtn} />
            </View>

            <Text style={styles.skipNote}>
              No notes? That's fine — just tap Run Analysis.
            </Text>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5, borderColor: Colors.separator,
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary, width: 24, borderRadius: 5 },
  stepDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.separator, maxWidth: 40 },
  stepTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: 26, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 6,
  },
  stepSubtitle: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, marginBottom: 28, lineHeight: 22 },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  formGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 16,
  },
  cellSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 16 },
  formCell: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13, minHeight: 50,
  },
  formLabel: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary },
  formInputRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  formPrefix: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textSecondary },
  formInput: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, minWidth: 80, textAlign: 'right' },
  lastMonthCard: { padding: 14, marginBottom: 24 },
  lastMonthTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary, marginBottom: 12, fontWeight: '500' },
  lastMonthRow: { flexDirection: 'row', justifyContent: 'space-around' },
  lastMonthItem: { alignItems: 'center', gap: 3 },
  lastMonthLabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textMuted },
  lastMonthValue: { fontFamily: Typography.fonts.heading, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  lastMonthChange: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, fontWeight: '600' },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 8 },
  moodBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  moodBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  moodEmoji: { fontSize: 28 },
  moodLabel: { padding: 12, marginBottom: 28, alignItems: 'center' },
  moodLabelText: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.primary, fontWeight: '500' },
  navButtons: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
  noteCard: { padding: 14, marginBottom: 20 },
  noteInput: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary, minHeight: 100, lineHeight: 23 },
  skipNote: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
