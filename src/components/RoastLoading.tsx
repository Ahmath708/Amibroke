import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // cycling step icons
import { CheckCircleIcon, ExclamationTriangleIcon } from 'react-native-heroicons/solid';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing } from '@/theme/colors';
import { useReducedMotion } from '@/components/motion';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
const STEPS: { label: string; icon: IoniconsName }[] = [
  { label: 'Reading your situation...', icon: 'book-outline' },
  { label: 'Calculating your score...', icon: 'calculator-outline' },
  { label: "Finding where you're bleeding...", icon: 'trending-down-outline' },
  { label: 'Writing your roast...', icon: 'flame-outline' },
  { label: 'Building your action plan...', icon: 'calendar-outline' },
];
const T = { spin: 1600, cycle: 2000, initialFade: 220, fadeOut: 140, fadeIn: 160, successFade: 260, shake: 140 };

// The roast "thinking" animation — a rotating ring + cycling step labels (NO progress bar). Owns the
// success/error landing too: pass `done`/`error`. Extracted from ProcessingScreen so it can be reused
// (the real roast in Processing, plus a mock viewing aid on Results). Reduce-motion gated.
export default function RoastLoading({ done = false, error = null }: { done?: boolean; error?: string | null }) {
  const [stepIndex, setStepIndex] = useState(0);
  const reduce = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.92)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: T.spin, easing: Easing.linear, useNativeDriver: true }),
    );
    if (!reduce) spinAnim.start();
    if (reduce) stepOpacity.setValue(1);
    else Animated.timing(stepOpacity, { toValue: 1, duration: T.initialFade, useNativeDriver: true }).start();

    const interval = setInterval(() => {
      if (reduce) { setStepIndex((i) => (i + 1) % STEPS.length); return; }
      Animated.timing(stepOpacity, { toValue: 0, duration: T.fadeOut, useNativeDriver: true }).start(() => {
        setStepIndex((i) => (i + 1) % STEPS.length);
        Animated.timing(stepOpacity, { toValue: 1, duration: T.fadeIn, useNativeDriver: true }).start();
      });
    }, T.cycle);

    return () => { clearInterval(interval); spinAnim.stop(); };
  }, [reduce]);

  // Success / error landing (driven by the props).
  useEffect(() => {
    if (done && !error) {
      if (reduce) { successScale.setValue(1); successOpacity.setValue(1); }
      else Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: T.successFade, useNativeDriver: true }),
      ]).start();
    } else if (error && !reduce) {
      Animated.sequence([
        Animated.timing(errorShake, { toValue: 1, duration: T.shake, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 0, duration: T.shake, useNativeDriver: true }),
      ]).start();
    }
  }, [done, error, reduce]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.wrap}>
      <View style={styles.ringWrap}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
          <LinearGradient colors={[Colors.accentSolid, 'transparent']} style={styles.ringGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        </Animated.View>
        <View style={styles.ringCenter}>
          <Animated.View style={{ transform: [{ scale: done ? successScale : 1 }, { translateX: error ? errorShake.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }) : 0 }] }}>
            <Animated.View style={{ opacity: done && !error ? successOpacity : 1 }}>
              {done ? (
                <CheckCircleIcon size={36} color={Colors.success} />
              ) : error ? (
                <ExclamationTriangleIcon size={36} color={Colors.warning} />
              ) : (
                <Ionicons name={STEPS[stepIndex].icon} size={36} color={Colors.accent} />
              )}
            </Animated.View>
          </Animated.View>
        </View>
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <Animated.Text style={[styles.stepText, { opacity: stepOpacity }]}>
          {done ? 'Roast complete!' : STEPS[stepIndex].label}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl },
  ringWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: 'transparent', overflow: 'hidden' },
  ringGradient: { width: '100%', height: '100%' },
  ringCenter: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.accentContainer,
    shadowColor: Colors.accentSolid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  stepText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, textAlign: 'center' },
  errorText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.danger, textAlign: 'center', marginHorizontal: Spacing.xl },
});
