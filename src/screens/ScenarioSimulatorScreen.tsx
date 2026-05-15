import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import GlassCard from '../components/GlassCard';
import NeonButton from '../components/NeonButton';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'ScenarioSimulator'> };

const PRESETS = [
  { id: '1', title: 'Job Loss', emoji: '😱', prompt: 'I just lost my job and have 2 months of emergency fund. What\'s my financial runway?' },
  { id: '2', title: 'New Baby', emoji: '👶', prompt: 'I\'m expecting a baby in 6 months. How will my finances change?' },
  { id: '3', title: 'Buy a Home', emoji: '🏠', prompt: 'I want to buy a $350k home in 3 years. What do I need to do?' },
  { id: '4', title: 'Pay Off Debt', emoji: '💳', prompt: 'I want to be completely debt-free in 2 years. Is that realistic?' },
  { id: '5', title: 'Start a Business', emoji: '🚀', prompt: 'I want to quit my job and start a business. Can I afford it?' },
  { id: '6', title: 'Early Retirement', emoji: '🌴', prompt: 'I want to retire at 45. What do I need to change now?' },
];

export default function ScenarioSimulatorScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  const handleRun = () => {
    const preset = PRESETS.find((p) => p.id === selected);
    const input = custom.trim() || preset?.prompt || '';
    if (input) navigation.navigate('Processing', { userInput: input });
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Model a life scenario and see how it would impact your financial health score.
        </Text>

        {/* Preset scenarios */}
        <Text style={styles.sectionLabel}>Quick Scenarios</Text>
        <View style={styles.presetGrid}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.presetCard, selected === p.id && styles.presetCardActive]}
              onPress={() => { setSelected(selected === p.id ? null : p.id); setCustom(''); }}
              activeOpacity={0.75}
            >
              <Text style={styles.presetEmoji}>{p.emoji}</Text>
              <Text style={[styles.presetTitle, selected === p.id && styles.presetTitleActive]}>
                {p.title}
              </Text>
            </TouchableOpacity>
          ))}
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
            <Text style={styles.previewText}>"{PRESETS.find((p) => p.id === selected)?.prompt}"</Text>
          </GlassCard>
        )}

        <NeonButton
          label="Run Scenario"
          onPress={handleRun}
          disabled={!selected && !custom.trim()}
          style={styles.cta}
          icon="⚡"
        />
        <Text style={styles.ctaHint}>Analysis takes ~5 seconds · Uses your stored financial profile</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  intro: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  presetCard: {
    width: '47%', backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: 16, alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
  },
  presetCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  presetEmoji: { fontSize: 28 },
  presetTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  presetTitleActive: { color: Colors.primary, fontFamily: Typography.fonts.bodySemi },
  inputCard: { padding: 14, marginBottom: 14 },
  customInput: {
    fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary,
    minHeight: 90, lineHeight: 23,
  },
  previewCard: { padding: 14, marginBottom: 20 },
  previewLabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewText: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 20 },
  cta: { marginBottom: 8 },
  ctaHint: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
