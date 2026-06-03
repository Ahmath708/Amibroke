import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // kept for the cycling step icons
import { CheckCircleIcon, ExclamationTriangleIcon } from 'react-native-heroicons/solid';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { analyzeFinances } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { trackFunnelStep, trackError } from '@/services/analytics';
import ScreenBackground from '@/components/ScreenBackground';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Processing'>;
  route: RouteProp<RootStackParamList, 'Processing'>;
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
const STEPS: { label: string; icon: IoniconsName }[] = [
  { label: 'Reading your situation...', icon: 'book-outline' },
  { label: 'Calculating your score...', icon: 'calculator-outline' },
  { label: 'Finding where you\'re bleeding...', icon: 'trending-down-outline' },
  { label: 'Writing your roast...', icon: 'flame-outline' },
  { label: 'Building your action plan...', icon: 'calendar-outline' },
];

export default function ProcessingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { userInput, tone, userContext } = route.params;
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spin = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  const ringPulse = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0.92)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;


  const doAnalysis = useCallback(async () => {
    setError(null);
    setDone(false);
    progressWidth.setValue(0);
    successOpacity.setValue(0);
    successScale.setValue(0.92);
    errorShake.setValue(0);
    stepOpacity.setValue(1);


    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const analysis = await analyzeFinances(userInput, tone || 'savage', controller.signal, 2, userContext as Record<string, unknown> | undefined);
      clearTimeout(timeout);
      trackFunnelStep('analysis_completed', { score: analysis.score, tone: tone || 'savage' });

      // Success animation
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();

      setDone(true);
      setTimeout(() => navigation.replace('Results', { analysis, userInput }), 520);

    } catch (e) {
      clearTimeout(timeout);
      let msg = e instanceof Error ? e.message : 'Something went wrong while analyzing. Please try again.';
      console.error('[Processing] Analysis error:', e);

      if (e instanceof Error && e.name === 'AbortError') {
        msg = 'Request timed out after 30 seconds. Check your internet connection and try again.';
      }

      // Error microinteraction
      Animated.sequence([
        Animated.timing(errorShake, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();

      trackError('analysis_failed', msg, 'ProcessingScreen');
      setError(msg);
    }

  }, [userInput, tone, user, navigation]);

  useEffect(() => {
    // Spin animation
    const spinAnim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }),
    );
    spinAnim.start();

    // Initial fade-in
    Animated.timing(stepOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();


    // Step cycling (iOS-ish crossfade + pulse)
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1.15, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setStepIndex((i) => (i + 1) % STEPS.length);
        Animated.parallel([
          Animated.timing(stepOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(ringPulse, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    }, 2000);

    // Progress bar (non-native driver because we're animating width)
    Animated.timing(progressWidth, { toValue: 1, duration: 10000, useNativeDriver: false }).start();

    doAnalysis();

    return () => {
      clearInterval(interval);
      spinAnim.stop();
    };
  }, [doAnalysis]);


  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container}>
      <ScreenBackground variant="processing" />
      <TouchableOpacity style={[styles.backBtn, { marginTop: insets.top + 8 }]} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })} activeOpacity={0.7}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
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
            <Animated.View
              style={{
                transform: [
                  { scale: done ? successScale : 1 },
                  { translateX: error ? errorShake.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }) : 0 },
                ],
              }}
            >
              <Animated.View style={{ opacity: done && !error ? successOpacity : 1 }}>
                {done ? (
                  <CheckCircleIcon size={36} color={Colors.success} />
                ) : error ? (
                  <ExclamationTriangleIcon size={36} color={Colors.warning} />
                ) : (
                  <Ionicons name={STEPS[stepIndex].icon} size={36} color={Colors.primary} />
                )}
              </Animated.View>
            </Animated.View>
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
          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.retryButton} onPress={doAnalysis} activeOpacity={0.7}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.retryButtonSecondary} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })} activeOpacity={0.7}>
              <Text style={styles.retryTextSecondary}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.hint}>
            Analyzing your finances with brutal honesty ✨
          </Text>
        )}
      </View>
    </View>
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
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primaryContainer,
    shadowColor: Colors.primarySolid, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  centerEmoji: {},
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
  errorActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    paddingHorizontal: Spacing.xl,
  },
  retryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  retryButtonSecondary: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  retryText: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.callout.fontSize, color: Colors.background, textAlign: 'center',
  },
  retryTextSecondary: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.callout.fontSize, color: Colors.textPrimary, textAlign: 'center',
  },
  backBtn: { position: 'absolute', top: 0, left: 16, zIndex: 10, padding: Spacing.sm },
  backBtnText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.tint },
});
