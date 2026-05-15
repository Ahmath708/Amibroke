import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import NeonButton from '../components/NeonButton';
import GlassCard from '../components/GlassCard';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const CHIPS = [
  'I spend more than I earn 😬',
  'I have $2k in credit card debt',
  'I haven\'t saved in 3 months',
  'My subscriptions are out of control',
  'I\'m living paycheck to paycheck',
  'I have no emergency fund',
];

const SCORES = [
  { score: 34, label: 'Financially Fragile', color: Colors.danger, user: 'anon_coffee_addict' },
  { score: 61, label: 'Getting By', color: Colors.warning, user: 'anon_rent_is_too_high' },
  { score: 78, label: 'Doing Alright', color: Colors.success, user: 'anon_crypto_regrets' },
];

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);
  const shimmer = useRef(new Animated.Value(0)).current;

  const handleAnalyze = () => {
    if (!input.trim()) {
      inputRef.current?.focus();
      return;
    }
    navigation.navigate('Processing', { userInput: input.trim() });
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Large Title header */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageLargeTitle}>Am I Broke?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.settingsBtn}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.pageSubtitle}>
            Describe your finances. Get roasted by AI. Fix your life.
          </Text>

          {/* Input card */}
          <GlassCard variant="inset" style={styles.inputCard}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={"e.g. \"I make $3,200/month, spend $1,400 on rent, $600 eating out, and I've got $8k in credit card debt across 3 cards...\""}
              placeholderTextColor={Colors.textMuted}
              multiline
              value={input}
              onChangeText={setInput}
              returnKeyType="default"
              textAlignVertical="top"
            />
            <View style={styles.inputFooter}>
              <Text style={styles.charCount}>{input.length} chars</Text>
              {input.length > 0 && (
                <TouchableOpacity onPress={() => setInput('')}>
                  <Text style={styles.clearBtn}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </GlassCard>

          {/* Suggestion chips */}
          <Text style={styles.sectionLabel}>Suggestions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
            {CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.chip}
                onPress={() => setInput((prev) => prev ? prev + ' ' + chip : chip)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* CTA */}
          <NeonButton
            label="Analyze My Finances"
            onPress={handleAnalyze}
            disabled={!input.trim()}
            style={styles.cta}
          />
          <Text style={styles.ctaHint}>Powered by Claude AI · Usually takes ~5 seconds</Text>

          {/* Recent community scores */}
          <Text style={styles.sectionLabel}>Community Scores</Text>
          <View style={styles.scoreCards}>
            {SCORES.map((s) => (
              <GlassCard key={s.user} style={styles.scoreCard}>
                <Text style={[styles.scoreNum, { color: s.color }]}>{s.score}</Text>
                <Text style={styles.scoreLabel}>{s.label}</Text>
                <Text style={styles.scoreUser}>@{s.user}</Text>
              </GlassCard>
            ))}
          </View>

          {/* Premium teaser */}
          <TouchableOpacity onPress={() => navigation.navigate('Paywall')} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(189,0,255,0.25)', 'rgba(231,0,110,0.20)']}
              style={styles.premiumBanner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View>
                <Text style={styles.premiumTitle}>✨ Go Premium</Text>
                <Text style={styles.premiumBody}>Debt payoff planner, scenario simulator, monthly check-ins & more.</Text>
              </View>
              <Text style={styles.premiumChevron}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  pageLargeTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: 34, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: 0.37,
  },
  settingsBtn: { paddingTop: 6 },
  settingsIcon: { fontSize: 22 },
  pageSubtitle: {
    fontFamily: Typography.fonts.body,
    fontSize: 15, color: Colors.textSecondary,
    marginBottom: 24, lineHeight: 21,
  },
  inputCard: { padding: 16, marginBottom: 16 },
  textInput: {
    fontFamily: Typography.fonts.body,
    fontSize: 16, color: Colors.textPrimary,
    minHeight: 120, lineHeight: 24,
  },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  charCount: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted },
  clearBtn: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.tint },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10, marginTop: 4,
  },
  chipsScroll: { marginHorizontal: -Spacing.xl, marginBottom: 20 },
  chipsContent: { paddingHorizontal: Spacing.xl, gap: 8 },
  chip: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  chipText: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.primary },
  cta: { marginBottom: 8 },
  ctaHint: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 28 },
  scoreCards: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  scoreCard: { flex: 1, padding: 14, alignItems: 'center' },
  scoreNum: { fontFamily: Typography.fonts.heading, fontSize: 28, fontWeight: '700' },
  scoreLabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  scoreUser: { fontFamily: Typography.fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  premiumTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: 16, color: Colors.primary, marginBottom: 4 },
  premiumBody: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, maxWidth: 240, lineHeight: 18 },
  premiumChevron: { fontSize: 26, color: Colors.primary, fontWeight: '300' },
});
