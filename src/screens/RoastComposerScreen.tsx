import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Alert,
  Animated, Easing,
} from 'react-native';
import SectionLabel from '@/components/SectionLabel';
import OptionChip from '@/components/OptionChip';
import AppTextInput from '@/components/AppTextInput';
import { MicrophoneIcon, StopCircleIcon, SparklesIcon, QuestionMarkCircleIcon } from 'react-native-heroicons/outline';
import { TONES } from '@/config/tones';
import NotificationBell from '@/components/NotificationBell';
import ReAnimated from 'react-native-reanimated';
import { PressableScale, useReducedMotion, enterUp } from '@/components/motion';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RoastTone, RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Durations } from '@/theme/motion';
import NeonButton from '@/components/NeonButton';
import GlassCard from '@/components/GlassCard';
import TypingPlaceholder from '@/components/TypingPlaceholder';
import { useAuth } from '@/context/AuthContext';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useScrollToTopFast } from '@/hooks/useScrollToTopFast';
import { ContextValues } from '@/components/FinancialContextForm';
import { getFinancialContext } from '@/services/financialContext';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useSubscription } from '@/hooks/useSubscription';
import { FEATURES } from '@/config/features';
import { trackFunnelStep } from '@/services/analytics';
import { getProfile, updateProfile } from '@/services/profile';
import { getSubscriptionContext } from '@/services/subscriptionAudit';
import ScreenBackground from '@/components/ScreenBackground';
import TopScrim from '@/components/TopScrim';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';

const MAX_INPUT_CHARS = 4000;

// Used in two places: inline as the first-run Home tab (DashboardScreen renders it
// when there are 0 analyses) and as the pushed "Analyze" route ("New roast"). Typed
// to the root stack so both call sites work; the stack header replaces the in-screen
// title when pushed (navigation.canGoBack()).
// `asTab` = rendered as the Roast tab (show the in-screen header); the pushed "Analyze" route
// leaves it false so the stack header ("New Roast") shows instead. (canGoBack() is unreliable here:
// switching to the Roast tab from another tab makes it true.)
type Props = { navigation: NativeStackNavigationProp<RootStackParamList>; asTab?: boolean };

const CHIPS = [
  'I spend more than I earn 😬',
  'I have $2k in credit card debt',
  'I haven\'t saved in 3 months',
  'My subscriptions are out of control',
  'I\'m living paycheck to paycheck',
  'I have no emergency fund',
];

const PLACEHOLDERS = [
  'I make 5k/month but somehow I\'m still broke...',
  'I spend too much on Uber Eats and my credit cards hate me.',
  'Rent is $1400, I make $3200, and I have $8k in debt...',
  'My DoorDash budget is bigger than my savings account...',
  'I have 3 credit cards and no idea how much I owe...',
];

export default function RoastComposerScreen({ navigation, asTab = false }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const onScroll = useScrollToTopFast(scrollRef); // re-tap the active tab → scroll to top (snappy)
  const { user } = useAuth();
  const { canUseApp } = useSubscription();
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedTone, setSelectedTone] = useState<RoastTone>('savage');
  // Saved personalization context (edited via the Financial Context screen).
  const [profileContext, setProfileContext] = useState<ContextValues>({});
  const [subContext, setSubContext] = useState(''); // logged subscriptions → roast context (approach A)
  const inputRef = useRef<TextInput>(null);
  const micPulse = useRef(new Animated.Value(1)).current;
  // Suggestion text fade-and-rise: the input text fades in + slides up when a chip is applied.
  const inputOpacity = useRef(new Animated.Value(1)).current;
  const inputTranslateY = useRef(new Animated.Value(0)).current;

  const { listening, transcript, startListening, stopListening, supported, error } = useVoiceInput();
  const reduce = useReducedMotion();
  const isFocused = useIsFocused(); // tabs stay mounted — pause the placeholder loop when off-screen

  // Reload saved personalization each time Home regains focus (e.g. after editing
  // it on the Financial Context screen) so analyses use the latest values.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (user) {
        (async () => {
          try {
            // One profile read (select('*')) serves both the saved context and the sticky tone;
            // stays resilient if preferred_tone isn't migrated yet (avoids PGRST204).
            const [prof, ctx] = await Promise.all([getProfile(user.id), getFinancialContext(user.id)]);
            if (active) {
              setProfileContext(ctx);
              if (prof?.preferred_tone) setSelectedTone(prof.preferred_tone as RoastTone); // seed the sticky voice
            }
          } catch { /* ignore */ }
          try {
            const sc = await getSubscriptionContext(user.id);
            if (active) setSubContext(sc);
          } catch { /* ignore */ }
        })();
      }
      return () => { active = false; };
    }, [user]),
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
    if (listening && !reduce) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.2, duration: Durations.slow, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1, duration: Durations.slow, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      micPulse.setValue(1); // reduce-motion or idle → no pulse
    }
  }, [listening, reduce]);

  const applySuggestion = (chip: string) => {
    // Replace the current input with the suggestion (PressableScale handles the press + haptic).
    setInput(chip);
    if (reduce) {
      // Reduce Motion: show the text immediately, no fade/slide.
      inputOpacity.setValue(1);
      inputTranslateY.setValue(0);
      return;
    }
    // Fade + rise the new input text in.
    inputOpacity.setValue(0);
    inputTranslateY.setValue(8);
    Animated.parallel([
      Animated.timing(inputOpacity, { toValue: 1, duration: Durations.fast, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(inputTranslateY, { toValue: 0, duration: Durations.fast, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const handleAnalyze = () => {
    if (!input.trim()) {
      inputRef.current?.focus();
      return;
    }
    // Hard paywall: once the 3-day free access expires with no plan, running a
    // roast is gated too (not just the premium tools). Flagged off until the
    // server-side check ships — see FEATURES.PAYWALL_ENFORCEMENT.
    if (FEATURES.PAYWALL_ENFORCEMENT && !canUseApp) {
      navigation.navigate('Paywall');
      return;
    }
    trackFunnelStep('input_submitted', { input_length: input.length, tone: selectedTone });
    const context = Object.keys(profileContext).length > 0 ? profileContext : undefined;
    navigation.navigate('Processing', { userInput: input.trim() + subContext, tone: selectedTone, userContext: context as any });
  };

  const handleVoiceToggle = async () => {
    if (listening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="home" />
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height', default: 'height' })} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scroll, { paddingTop: asTab ? insets.top + Spacing.lg : Spacing.xs, paddingBottom: (asTab ? TAB_BAR_HEIGHT : insets.bottom) + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Large Title header — only as the first-run Home tab; when pushed as the
              "Analyze" route, the stack header ("New Roast") replaces it. */}
          {asTab && (
            <View style={styles.pageHeader}>
              <Text style={styles.pageLargeTitle}>Roast Me</Text>
              <NotificationBell />
            </View>
          )}
          <Text style={styles.pageSubtitle}>
            Describe your finances. Get roasted by AI.{' '}
            <Text style={styles.pageSubtitleStrong}>Fix your life.</Text>
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
                  <TypingPlaceholder placeholders={PLACEHOLDERS} textStyle={styles.placeholderText} paused={!isFocused} typingSpeed={30} deletingSpeed={7} />
                </View>
              )}
            </View>
            <View style={styles.inputFooter}>
              <Text style={styles.charCount}>{input.length}/{MAX_INPUT_CHARS}</Text>
              <View style={styles.inputActions}>
                {input.length > 0 && (
                  <PressableScale onPress={() => setInput('')} hitSlop={8}>
                    <Text style={styles.clearBtn}>Clear</Text>
                  </PressableScale>
                )}
                {supported && (
                  <PressableScale
                    onPress={handleVoiceToggle}
                    style={[styles.micBtn, listening && styles.micBtnActive]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={listening ? 'Stop recording' : 'Voice input'}
                  >
                    <Animated.View style={{ transform: [{ scale: micPulse }] }}>
                      {listening
                        ? <StopCircleIcon size={20} color={Colors.danger} />
                        : <MicrophoneIcon size={20} color={Colors.textSecondary} />}
                    </Animated.View>
                  </PressableScale>
                )}
              </View>
            </View>
          </GlassCard>

          {/* No-Plaid honesty cue — sets expectations (input-based, not bank-linked)
              and nudges honest input, which is how we stay accurate without Plaid. */}
          <View style={styles.honestyRow}>
            <SparklesIcon size={13} color={Colors.accentSolid} />
            <Text style={styles.honestyText}>
              I only know what you tell me — the realer the input, the sharper the roast.
            </Text>
          </View>

          {/* CTA — directly under the input for immediate access */}
          <NeonButton
            label="Roast My Finances →"
            onPress={handleAnalyze}
            disabled={!input.trim()}
            style={styles.cta}
          />
          <Text style={styles.ctaHint}>Powered by Claude · Results in seconds</Text>

          {/* Suggestion chips */}
          <SectionLabel>Need a starting point?</SectionLabel>
          <View style={styles.chipsScrollWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
              {CHIPS.map((chip) => (
                <PressableScale key={chip} style={styles.chip} onPress={() => applySuggestion(chip)} haptic="light" hitSlop={{ top: 6, bottom: 6 }}>
                  <QuestionMarkCircleIcon size={15} color={Colors.accent} />
                  <Text style={styles.chipText}>{chip}</Text>
                </PressableScale>
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
          <SectionLabel>Roast Tone</SectionLabel>
          <View style={styles.toneWrap}>
            {TONES.map((tone) => (
              <OptionChip
                key={tone.key}
                label={tone.label}
                icon={tone.icon}
                active={selectedTone === tone.key}
                onPress={() => {
                  setSelectedTone(tone.key);
                  if (user) updateProfile(user.id, { preferred_tone: tone.key }).catch(() => {}); // sticky
                }}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {asTab && <TopScrim variant="home" />}
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.xs },
  pageLargeTitle: {
    ...Typography.screenTitle,
    fontFamily: Typography.fonts.heading,
    color: Colors.textPrimary,
  },
  pageSubtitle: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize, color: Colors.textSecondary,
    marginBottom: Spacing.xxl, lineHeight: 21,
  },
  pageSubtitleStrong: { fontFamily: Typography.fonts.bodySemi, color: Colors.textPrimary },
  inputCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  honestyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.xs, marginBottom: Spacing.lg,
  },
  honestyText: {
    flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary, lineHeight: 16,
  },
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
  // Match textInput's font metrics exactly (family, size, line height, upright) so the animated
  // placeholder + its caret line up with real typed text — no jump on the hand-off.
  placeholderText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, lineHeight: 24, fontStyle: 'normal' },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  charCount: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  inputActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  clearBtn: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.accent },
  micBtn: { padding: Spacing.xs },
  micBtnActive: { backgroundColor: Colors.accentContainer, borderRadius: Radius.pill },
  chipsScrollWrap: { position: 'relative', marginHorizontal: -Spacing.xl, marginBottom: Spacing.xl },
  chipsFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 36 },
  chipsContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accentContainer,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,0,122,0.4)',
  },
  chipText: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.accent },
  toneWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: 0 },
  cta: { marginBottom: Spacing.sm },
  ctaHint: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
});
