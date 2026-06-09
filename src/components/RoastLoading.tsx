import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CheckCircleIcon, ExclamationTriangleIcon } from 'react-native-heroicons/solid';
import { Colors, Typography, Spacing } from '@/theme/colors';
import { useReducedMotion } from '@/components/motion';
import { getScoreBand } from '@shared/scoring/bands.ts';

const PHASES = [
  'Reading your situation...',
  'Calculating your score...',
  'Finding the leaks...',
  'Writing your roast...',
  'Building your action plan...',
];

const RING = 132;
const R = 60;
const C = 2 * Math.PI * R;
const ARC = C * 0.28; // bright sweeping segment
const SPARK_X = [-44, -18, 8, 30, -28, 44]; // horizontal scatter of the rising sparks

// One subtle rising ember (loops): fades in low, rises, fades out — ambient "energy" around the ring.
function Spark({ index }: { index: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(p, { toValue: 1, duration: 2600, delay: index * 430, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[styles.spark, {
        left: RING / 2 + SPARK_X[index] - 2,
        opacity: p.interpolate({ inputRange: [0, 0.18, 0.7, 1], outputRange: [0, 0.55, 0.4, 0] }),
        transform: [
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [26, -66] }) },
          { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
        ],
      }]}
    />
  );
}

// The roast "thinking" animation — leans into the app's North Star, the SCORE. A bright arc SWEEPS
// around a glowing, breathing score ring while a number scrambles through random values + band colors
// ("computing your score…"), with cycling phase copy below. No progress bar / no implied finish.
// Owns the success/error landing via `done`/`error`. Reduce-motion → static ring + "?", no motion.
export default function RoastLoading({ done = false, error = null }: { done?: boolean; error?: string | null }) {
  const [phaseI, setPhaseI] = useState(0);
  const [num, setNum] = useState(42);
  const reduce = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const label = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.92)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  const settled = done || !!error;

  // Scrambling "score" — the centerpiece.
  useEffect(() => {
    if (settled || reduce) return;
    const id = setInterval(() => setNum(Math.floor(Math.random() * 100)), 140);
    return () => clearInterval(id);
  }, [settled, reduce]);

  // Sweeping arc + breathing ring + cycling phases.
  useEffect(() => {
    let spinAnim: Animated.CompositeAnimation | undefined;
    let pulseAnim: Animated.CompositeAnimation | undefined;
    if (!reduce) {
      spinAnim = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
      pulseAnim = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]));
      spinAnim.start(); pulseAnim.start();
    }
    label.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(label, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const interval = setInterval(() => {
      if (reduce) { setPhaseI((n) => (n + 1) % PHASES.length); return; }
      Animated.timing(label, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        setPhaseI((n) => (n + 1) % PHASES.length);
        Animated.timing(label, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      });
    }, 2000);
    return () => { clearInterval(interval); spinAnim?.stop(); pulseAnim?.stop(); };
  }, [reduce]);

  // Success / error landing.
  useEffect(() => {
    if (done && !error) {
      if (reduce) { successScale.setValue(1); successOpacity.setValue(1); }
      else Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else if (error && !reduce) {
      Animated.sequence([
        Animated.timing(errorShake, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [done, error, reduce]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const bandColor = getScoreBand(num).color;
  const showArc = !settled && !reduce;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ringWrap, { transform: [{ scale: settled ? 1 : pulse }] }]}>
        <View style={styles.ringBg} />
        {showArc && SPARK_X.map((_, idx) => <Spark key={idx} index={idx} />)}
        <Animated.View style={[styles.ringSvg, showArc && { transform: [{ rotate }] }]}>
          <Svg width={RING} height={RING}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={Colors.accentContainer} strokeWidth={3.5} fill="none" />
            {showArc && (
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={Colors.accentSolid} strokeWidth={3.5} fill="none" strokeDasharray={`${ARC} ${C - ARC}`} strokeLinecap="round" />
            )}
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.center, {
          opacity: done && !error ? successOpacity : 1,
          transform: [
            { scale: done ? successScale : 1 },
            { translateX: error ? errorShake.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }) : 0 },
          ],
        }]}>
          {done ? (
            <CheckCircleIcon size={44} color={Colors.success} />
          ) : error ? (
            <ExclamationTriangleIcon size={44} color={Colors.warning} />
          ) : (
            <>
              <Text style={[styles.scoreNum, { color: reduce ? Colors.textSecondary : bandColor }]}>{reduce ? '?' : num}</Text>
              <Text style={styles.scoreOutOf}>/ 100</Text>
            </>
          )}
        </Animated.View>
      </Animated.View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <Animated.Text style={[styles.phaseText, { opacity: label }]}>{done ? 'Roast complete!' : PHASES[phaseI]}</Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringBg: {
    position: 'absolute', width: RING - 14, height: RING - 14, borderRadius: (RING - 14) / 2, backgroundColor: Colors.surfaceElevated,
    shadowColor: Colors.accentSolid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 24, elevation: 12,
  },
  ringSvg: { position: 'absolute', width: RING, height: RING },
  spark: {
    position: 'absolute', top: RING / 2 - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accentSolid,
    shadowColor: Colors.accentSolid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4,
  },
  center: { position: 'absolute', alignItems: 'center' },
  scoreNum: { fontFamily: Typography.fonts.heading, fontSize: 46, fontWeight: '800', lineHeight: 50 },
  scoreOutOf: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textMuted, marginTop: -2 },
  phaseText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, textAlign: 'center' },
  errorText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.danger, textAlign: 'center', marginHorizontal: Spacing.xl },
});
