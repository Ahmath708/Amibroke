import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, AnalysisHistoryItem, RoastTone } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import GlassCard from '@/components/GlassCard';
import TypingPlaceholder from '@/components/TypingPlaceholder';
import { getAnalysisHistory } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { trackFunnelStep } from '@/services/analytics';
import ScreenBackground from '@/components/ScreenBackground';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const CHIPS = [
  'I spend more than I earn 😬',
  'I have $2k in credit card debt',
  'I haven\'t saved in 3 months',
  'My subscriptions are out of control',
  'I\'m living paycheck to paycheck',
  'I have no emergency fund',
];

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
const TONES: { key: RoastTone; label: string; icon: IoniconsName }[] = [
  { key: 'savage',        label: 'Savage',       icon: 'flame-outline' },
  { key: 'gentle',        label: 'Gentle',       icon: 'heart-outline' },
  { key: 'therapist',     label: 'Therapist',    icon: 'medical-outline' },
  { key: 'older_sibling', label: 'Big Sibling',  icon: 'fitness-outline' },
  { key: 'finance_bro',   label: 'Finance Bro',  icon: 'trending-up-outline' },
];

const PLACEHOLDERS = [
  'I make 5k/month but somehow I\'m still broke...',
  'I spend too much on Uber Eats and my credit cards hate me.',
  'Rent is $1400, I make $3200, and I have $8k in debt...',
  'My DoorDash budget is bigger than my savings account...',
  'I have 3 credit cards and no idea how much I owe...',
];

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [selectedTone, setSelectedTone] = useState<RoastTone>('savage');
  const inputRef = useRef<TextInput>(null);
  const [recentScores, setRecentScores] = useState<AnalysisHistoryItem[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);
  const micPulse = useRef(new Animated.Value(1)).current;

  const { listening, transcript, startListening, stopListening, supported, error } = useVoiceInput();
  const { animatedStyle } = useEntryAnimation();

  useEffect(() => {
    if (!user) {
      setScoresLoading(false);
      return;
    }
    getAnalysisHistory(user.id)
      .then((data) => setRecentScores(data?.slice(0, 3) || []))
      .catch(() => console.warn('Failed to load recent scores'))
      .finally(() => setScoresLoading(false));
  }, [user]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (error) {
      Alert.alert('Voice Input', error);
    }
  }, [error]);

  useEffect(() => {
    if (listening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      micPulse.setValue(1);
    }
  }, [listening]);

  const handleAnalyze = () => {
    if (!input.trim()) {
      inputRef.current?.focus();
      return;
    }
    trackFunnelStep('input_submitted', { input_length: input.length, tone: selectedTone });
    navigation.navigate('Processing', { userInput: input.trim(), tone: selectedTone });
  };

  const handleVoiceToggle = async () => {
    if (listening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="home" />
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height', default: 'height' })} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Large Title header */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageLargeTitle}>Am I Broke?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate(user ? 'Settings' : 'Login')}
              style={styles.settingsBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name={user ? 'settings-outline' : 'person-outline'}
                size={22}
                color={Colors.textSecondary}
              />
              {!user && <Text style={styles.loginHint}>Log In</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.pageSubtitle}>
            Describe your finances. Get roasted by AI. Fix your life.
          </Text>

          {/* Input card */}
          <GlassCard variant="inset" style={styles.inputCard}>
            <View style={styles.inputFieldWrap}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder=""
                placeholderTextColor={Colors.textMuted}
                multiline
                value={input}
                onChangeText={setInput}
                returnKeyType="default"
                textAlignVertical="top"
              />
              {input.length === 0 && (
                <View style={styles.placeholderOverlay} pointerEvents="none">
                  <TypingPlaceholder placeholders={PLACEHOLDERS} />
                </View>
              )}
            </View>
            <View style={styles.inputFooter}>
              <Text style={styles.charCount}>{input.length} chars</Text>
              <View style={styles.inputActions}>
                {input.length > 0 && (
                  <TouchableOpacity onPress={() => setInput('')}>
                    <Text style={styles.clearBtn}>Clear</Text>
                  </TouchableOpacity>
                )}
                {supported && (
                  <TouchableOpacity
                    onPress={handleVoiceToggle}
                    style={[styles.micBtn, listening && styles.micBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Animated.View style={{ transform: [{ scale: micPulse }] }}>
                      <Ionicons
                        name={listening ? 'stop-circle-outline' : 'mic-outline'}
                        size={20}
                        color={listening ? Colors.danger : Colors.textSecondary}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                )}
              </View>
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

          {/* Roast Tone selector */}
          <Text style={styles.sectionLabel}>Roast Tone</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
            {TONES.map((tone) => (
              <TouchableOpacity
                key={tone.key}
                style={[styles.toneChip, selectedTone === tone.key && styles.toneChipActive]}
                onPress={() => setSelectedTone(tone.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tone.icon}
                  size={16}
                  color={selectedTone === tone.key ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.toneLabel, selectedTone === tone.key && styles.toneLabelActive]}>{tone.label}</Text>
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

          {/* Recent scores */}
          {!scoresLoading && recentScores.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Your Recent Scores</Text>
              <View style={styles.scoreCards}>
                {recentScores.map((s) => {
                  const color = s.score < 40 ? Colors.danger : s.score < 65 ? Colors.warning : Colors.success;
                  return (
                    <GlassCard key={s.id} style={styles.scoreCard}>
                      <Text style={[styles.scoreNum, { color }]}>{s.score}</Text>
                      <Text style={styles.scoreLabel}>{s.score_label}</Text>
                      <Text style={styles.scoreUser}>{new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    </GlassCard>
                  );
                })}
              </View>
            </>
          )}

          {/* Premium teaser */}
          <TouchableOpacity onPress={() => navigation.navigate('Paywall')} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(189,0,255,0.25)', 'rgba(231,0,110,0.20)']}
              style={styles.premiumBanner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View>
                <Text style={styles.premiumTitle}>Go Premium</Text>
                <Text style={styles.premiumBody}>Debt payoff planner, scenario simulator, monthly check-ins & more.</Text>
              </View>
              <Text style={styles.premiumChevron}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.xs },
  pageLargeTitle: {
    ...Typography.largeTitle,
    fontFamily: Typography.fonts.heading,
    color: Colors.textPrimary,
  },
  settingsBtn: { marginTop: Spacing.xs, alignItems: 'center' },
  settingsIcon: { fontSize: Typography.title2.fontSize },
  loginHint: { fontFamily: Typography.fonts.bodyMed, fontSize: 10, color: Colors.primary, marginTop: 2 },
  pageSubtitle: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize, color: Colors.textSecondary,
    marginBottom: Spacing.xxl, lineHeight: 21,
  },
  inputCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  inputFieldWrap: { position: 'relative', minHeight: 120 },
  placeholderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
  },
  textInput: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.callout.fontSize, color: Colors.textPrimary,
    minHeight: 120, lineHeight: 24,
  },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  charCount: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted },
  inputActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  clearBtn: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.tint },
  micBtn: { padding: Spacing.xs },
  micBtnActive: { backgroundColor: Colors.primaryContainer, borderRadius: Radius.pill },
  micIcon: { fontSize: Typography.subhead.fontSize },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.sm, marginTop: Spacing.xs,
  },
  chipsScroll: { marginHorizontal: -Spacing.xl, marginBottom: Spacing.xl },
  chipsContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  chip: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  chipText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.primary },
  toneChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
  },
  toneChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  toneEmoji: { fontSize: Typography.subhead.fontSize },
  toneLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  toneLabelActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  cta: { marginBottom: Spacing.sm },
  ctaHint: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.xxl + Spacing.xs },
  scoreCards: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  scoreCard: { flex: 1, padding: Spacing.md, alignItems: 'center' },
  scoreNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.title1.fontSize, fontWeight: '700' },
  scoreLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  scoreUser: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, marginTop: Spacing.xs },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  premiumTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.callout.fontSize, color: Colors.primary, marginBottom: Spacing.xs },
  premiumBody: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, maxWidth: 240, lineHeight: 18 },
  premiumChevron: { fontSize: Typography.title2.fontSize, color: Colors.primary, fontWeight: '300' },
});
