import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { analyzeFinances, saveAnalysis } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { trackFunnelStep, trackError } from '@/services/analytics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Processing'>;
  route: RouteProp<RootStackParamList, 'Processing'>;
};

const STEPS = [
  { label: 'Reading your situation...', emoji: '📖' },
  { label: 'Calculating your score...', emoji: '🧮' },
  { label: 'Finding where you\'re bleeding...', emoji: '🩸' },
  { label: 'Writing your roast...', emoji: '🔥' },
  { label: 'Building your action plan...', emoji: '🗓️' },
];

export default function ProcessingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { userInput, tone } = route.params;
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spin = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  const doAnalysis = useCallback(async () => {
    setError(null);
    setDone(false);
    progressWidth.setValue(0);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const analysis = await analyzeFinances(userInput, tone || 'savage', controller.signal);
      clearTimeout(timeout);
      if (user) {
        await saveAnalysis(user.id, userInput, analysis);
      }
      trackFunnelStep('analysis_completed', { score: analysis.score, tone: tone || 'savage' });
      setDone(true);
      setTimeout(() => navigation.replace('Results', { analysis, userInput }), 400);
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : 'Analysis failed. Please try again.';
      trackError('analysis_failed', msg, 'ProcessingScreen');
      setError(msg);
    }
  }, [userInput, tone, user, navigation]);

  useEffect(() => {
    // Spin animation
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Step cycling
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(stepOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(stepOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 1200);

    // Progress bar
    Animated.timing(progressWidth, { toValue: 1, duration: 6000, useNativeDriver: false }).start();

    doAnalysis();

    return () => clearInterval(interval);
  }, [doAnalysis]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <View style={[styles.inner, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Rotating ring */}
        <View style={styles.ringWrap}>
          <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
            <LinearGradient
              colors={[Colors.primarySolid, 'transparent']}
              style={styles.ringGradient}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            />
          </Animated.View>
          <View style={styles.ringCenter}>
            <Text style={styles.centerEmoji}>{done ? '✅' : error ? '⚠️' : STEPS[stepIndex].emoji}</Text>
          </View>
        </View>

        {/* Status */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Animated.Text style={[styles.stepText, { opacity: stepOpacity }]}>
            {done ? 'Analysis complete!' : STEPS[stepIndex].label}
          </Animated.Text>
        )}

        {/* Progress bar */}
        {!error && (
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, {
              width: progressWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
            }]} />
          </View>
        )}

        {error ? (
          <TouchableOpacity style={styles.retryButton} onPress={doAnalysis} activeOpacity={0.7}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>
            Claude is analyzing your finances with brutal honesty ✨
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.xxl },
  ringWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: 'transparent',
    overflow: 'hidden',
  },
  ringGradient: { width: '100%', height: '100%' },
  ringCenter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.groupedRow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primaryContainer,
    shadowColor: Colors.primarySolid, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  centerEmoji: { fontSize: 36 },
  stepText: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.headline.fontSize, color: Colors.textPrimary, textAlign: 'center',
  },
  progressTrack: {
    width: '80%', height: 4, backgroundColor: Colors.backgroundSecondary,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  hint: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.footnote.fontSize, color: Colors.textMuted, textAlign: 'center',
  },
  errorText: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.subhead.fontSize, color: Colors.danger, textAlign: 'center',
    marginHorizontal: Spacing.xl,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: 40,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  retryText: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.callout.fontSize, color: Colors.background, textAlign: 'center',
  },
});
