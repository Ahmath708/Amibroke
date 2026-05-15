import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { analyzeFinances } from '../services/claudeApi';
import { Colors, Typography, Spacing } from '../theme/colors';

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
  const { userInput } = route.params;
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  const spin = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

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

    // API call
    analyzeFinances(userInput).then((analysis) => {
      clearInterval(interval);
      setDone(true);
      setTimeout(() => navigation.replace('Results', { analysis, userInput }), 400);
    });

    return () => clearInterval(interval);
  }, []);

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
            <Text style={styles.centerEmoji}>{done ? '✅' : STEPS[stepIndex].emoji}</Text>
          </View>
        </View>

        {/* Status */}
        <Animated.Text style={[styles.stepText, { opacity: stepOpacity }]}>
          {done ? 'Analysis complete!' : STEPS[stepIndex].label}
        </Animated.Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, {
            width: progressWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
          }]} />
        </View>

        <Text style={styles.hint}>
          Claude is analyzing your finances with brutal honesty ✨
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: 28 },
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
    shadowOpacity: 0.5, shadowRadius: 20,
  },
  centerEmoji: { fontSize: 36 },
  stepText: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 17, color: Colors.textPrimary, textAlign: 'center',
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
    fontSize: 13, color: Colors.textMuted, textAlign: 'center',
  },
});
