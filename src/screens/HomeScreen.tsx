import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
  Animated,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import { Ionicons } from '@expo/vector-icons';
import { selection } from '@/utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AnalysisHistoryItem, RoastTone, TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import NeonButton from '@/components/NeonButton';
import GlassCard from '@/components/GlassCard';
import TypingPlaceholder from '@/components/TypingPlaceholder';
import { getAnalysisHistory } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { ContextValues, CTX_COLUMNS, valuesFromProfile } from '@/components/FinancialContextForm';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { trackFunnelStep } from '@/services/analytics';
import ScreenBackground from '@/components/ScreenBackground';
import PremiumCard from '@/components/PremiumCard';
import CheckinCard from '@/components/CheckinCard';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';

const MAX_INPUT_CHARS = 4000;

type Props = { navigation: TabScreenNav<'Home'> };

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
  const { user, supabase } = useAuth();
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedTone, setSelectedTone] = useState<RoastTone>('savage');
  // Saved personalization context (edited via the Financial Context screen).
  const [profileContext, setProfileContext] = useState<ContextValues>({});
  const inputRef = useRef<TextInput>(null);
  const [recentScores, setRecentScores] = useState<AnalysisHistoryItem[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);
  const micPulse = useRef(new Animated.Value(1)).current;
  // Suggestion fade-and-rise: input text fades in + slides up; tapped chip bounces.
  const inputOpacity = useRef(new Animated.Value(1)).current;
  const inputTranslateY = useRef(new Animated.Value(0)).current;
  const chipScales = useRef<Record<string, Animated.Value>>({}).current;
  const getChipScale = (chip: string) => {
    if (!chipScales[chip]) chipScales[chip] = new Animated.Value(1);
    return chipScales[chip];
  };

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

  // Reload saved personalization each time Home regains focus (e.g. after editing
  // it on the Financial Context screen) so analyses use the latest values.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (user) {
        (async () => {
          try {
            const { data } = await supabase.from('profiles').select(CTX_COLUMNS).eq('id', user.id).maybeSingle();
            if (active) setProfileContext(valuesFromProfile(data as Record<string, unknown> | null));
          } catch { /* ignore */ }
        })();
      }
      return () => { active = false; };
    }, [user, supabase]),
  );

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

  const applySuggestion = (chip: string) => {
    selection();
    // Replace the current input with the suggestion (clear-then-insert).
    setInput(chip);
    // Bounce the tapped chip.
    const scale = getChipScale(chip);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    // Fade + rise the new input text in.
    inputOpacity.setValue(0);
    inputTranslateY.setValue(8);
    Animated.parallel([
      Animated.timing(inputOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(inputTranslateY, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleAnalyze = () => {
    if (!input.trim()) {
      inputRef.current?.focus();
      return;
    }
    trackFunnelStep('input_submitted', { input_length: input.length, tone: selectedTone });
    const context = Object.keys(profileContext).length > 0 ? profileContext : undefined;
    navigation.navigate('Processing', { userInput: input.trim(), tone: selectedTone, userContext: context as any });
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
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
              <Animated.View style={{ opacity: inputOpacity, transform: [{ translateY: inputTranslateY }] }}>
                <AppTextInput
                  ref={inputRef}
                  style={styles.textInput}
                  placeholder=""
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  scrollEnabled
                  maxLength={MAX_INPUT_CHARS}
                  value={input}
                  onChangeText={setInput}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  returnKeyType="default"
                  textAlignVertical="top"
                />
              </Animated.View>
              {/* Animated placeholder only when empty AND not focused — stops the
                  typing animation the moment the user is about to type. */}
              {input.length === 0 && !inputFocused && (
                <View style={styles.placeholderOverlay} pointerEvents="none">
                  <TypingPlaceholder placeholders={PLACEHOLDERS} textStyle={styles.placeholderText} />
                </View>
              )}
            </View>
            <View style={styles.inputFooter}>
              <Text style={styles.charCount}>{input.length}/{MAX_INPUT_CHARS}</Text>
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

          {/* CTA — directly under the input for immediate access */}
          <NeonButton
            label="Analyze My Finances"
            onPress={handleAnalyze}
            disabled={!input.trim()}
            style={styles.cta}
          />
          <Text style={styles.ctaHint}>Powered by Claude · Results in seconds</Text>

          {/* Suggestion chips */}
          <Text style={styles.sectionLabel}>Suggestions</Text>
          <View style={styles.chipsScrollWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
              {CHIPS.map((chip) => (
                <Animated.View key={chip} style={{ transform: [{ scale: getChipScale(chip) }] }}>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => applySuggestion(chip)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipText}>{chip}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
            {/* Right-edge fade: signals there are more suggestions to scroll to. */}
            <LinearGradient
              colors={['transparent', Colors.background]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.chipsFade}
              pointerEvents="none"
            />
          </View>

          {/* Roast Tone selector */}
          <Text style={styles.sectionLabel}>Roast Tone</Text>
          <View style={styles.toneWrap}>
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
          </View>

          {/* Financial context — opens the personalization form */}
          <TouchableOpacity
            onPress={() => navigation.navigate('FinancialContext')}
            activeOpacity={0.7}
            style={styles.contextRow}
          >
            <Text style={styles.contextRowText}>
              {Object.keys(profileContext).length > 0 ? 'Edit Financial Context' : '+ Add Financial Context (optional)'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Monthly check-in nudge (only for users who track goals) */}
          <CheckinCard onPress={() => navigation.navigate('MonthlyCheckIn')} style={{ marginBottom: Spacing.xl }} />

          {/* Recent scores */}
          {!scoresLoading && recentScores.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Your Recent Scores</Text>
              <View style={styles.scoreCards}>
                {recentScores.map((s) => {
                  const color = getScoreBand(s.score).color; // single source of truth — matches Results
                  return (
                    <GlassCard key={s.id} style={styles.scoreCard}>
                      <Text style={[styles.scoreNum, { color }]}>{s.score}</Text>
                      <Text style={styles.scoreLabel} numberOfLines={1}>{s.score_label}</Text>
                      <Text style={styles.scoreUser}>{new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    </GlassCard>
                  );
                })}
              </View>
            </>
          )}

          {/* Premium teaser */}
          <PremiumCard onPress={() => navigation.navigate('Paywall')} />
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
  inputFieldWrap: { position: 'relative', height: 160 },
  placeholderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
  },
  textInput: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.callout.fontSize, color: Colors.textPrimary,
    height: 160, lineHeight: 24, // fixed height — overflow scrolls inside the box
    padding: 0, // remove iOS multiline inset so typed text aligns with the placeholder
  },
  // Must match textInput's font metrics exactly so there's no jump when typing starts.
  placeholderText: { fontSize: Typography.callout.fontSize, lineHeight: 24 },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  charCount: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
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
  chipsScrollWrap: { position: 'relative', marginHorizontal: -Spacing.xl, marginBottom: Spacing.xl },
  chipsFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 36 },
  chipsContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  chip: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  chipText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.primary },
  toneWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
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
  contextRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, marginBottom: Spacing.md,
  },
  contextRowText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.tint },
  ctaHint: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  scoreCards: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  scoreCard: { flex: 1, padding: Spacing.md, alignItems: 'center' },
  scoreNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.title1.fontSize, fontWeight: '700' },
  scoreLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  scoreUser: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: Spacing.xs },
});
