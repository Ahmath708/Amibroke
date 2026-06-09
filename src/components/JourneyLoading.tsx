import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, useAnimatedReaction,
  withTiming, withSpring, withSequence, runOnJS, cancelAnimation, useReducedMotion,
} from 'react-native-reanimated';
import { FlagIcon } from 'react-native-heroicons/solid';
import { Colors, Typography, Spacing } from '@/theme/colors';
import { Easings, Springs } from '@/theme/motion';
import { impact, ImpactFeedbackStyle } from '@/utils/haptics';
import { getScoreBand } from '@shared/scoring/bands.ts';

// The 90-day plan "building" animation: a trail draws Day 0 → Day 90; week-checkpoint nodes spring +
// pulse as the line passes; when the line lands, an end-dot pops in and a goal flag plants dead-center
// on it with a green bloom + a light haptic. The whole scene cross-fades on loop (no restart flash).
// Reanimated v4 (same language as ScoreRing). Reduce-motion → static finished journey, no loop/haptic.

const SCENE_W = 260, SCENE_H = 120;
// The climb is lowered (peak y34) so the planted flag + glow stay INSIDE the 120px box.
const PATH_D = 'M 20 100 C 64 100, 70 66, 104 64 S 150 70, 168 52 S 218 40, 240 34';
const PATH_LEN = 238; // ≈ the real measured path length (236.4) so the draw finishes exactly at the end
const NODES = [{ x: 104, y: 64 }, { x: 168, y: 52 }, { x: 212, y: 40 }];
const NODE_T = [0.33, 0.62, 0.85];
const START = { x: 20, y: 100 };
const GOAL = { x: 240, y: 34 };
const GOAL_COLOR = getScoreBand(81).color; // Thriving green — the single intentional non-accent
const PHASES = ['Crunching your numbers...', 'Mapping your 90 days...', 'Prioritizing your wins...', 'Locking it in...'];

const AnimatedPath = Animated.createAnimatedComponent(Path);
function popPulse() {
  'worklet';
  return withSequence(
    withSpring(1, Springs.bouncy),
    withTiming(1.18, { duration: 180, easing: Easings.bounce }),
    withTiming(1, { duration: 180, easing: Easings.smooth }),
  );
}

export default function JourneyLoading() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const draw = useSharedValue(reduce ? 1 : 0);       // line draw 0→1 (drives node pops too)
  const startPop = useSharedValue(reduce ? 1 : 0);
  const n0 = useSharedValue(reduce ? 1 : 0);
  const n1 = useSharedValue(reduce ? 1 : 0);
  const n2 = useSharedValue(reduce ? 1 : 0);
  const endDot = useSharedValue(reduce ? 1 : 0);     // the dot that pops in when the line lands
  const flagPop = useSharedValue(reduce ? 1 : 0);
  const bloom = useSharedValue(0);
  const sceneFade = useSharedValue(reduce ? 1 : 0);  // whole-scene opacity (smooth loop restart)
  const labelO = useSharedValue(1);
  const hapticGuard = useRef(false);

  const fireHaptic = () => {
    if (hapticGuard.current) return;
    hapticGuard.current = true;
    impact(ImpactFeedbackStyle.Light);
  };
  const advancePhase = () => {
    setPhase((x) => (x + 1) % PHASES.length);
    labelO.value = withTiming(1, { duration: 160 });
  };

  // Nodes pop off the line's progress (spatial stagger, not timed).
  useAnimatedReaction(
    () => draw.value,
    (cur, prev) => {
      if (reduce) return;
      const p = prev ?? 0;
      if (p < NODE_T[0] && cur >= NODE_T[0]) n0.value = popPulse();
      if (p < NODE_T[1] && cur >= NODE_T[1]) n1.value = popPulse();
      if (p < NODE_T[2] && cur >= NODE_T[2]) n2.value = popPulse();
    },
  );

  useEffect(() => {
    if (reduce) {
      draw.value = 1; startPop.value = 1; n0.value = 1; n1.value = 1; n2.value = 1; endDot.value = 1; flagPop.value = 1; bloom.value = 0; sceneFade.value = 1; labelO.value = 1;
      const iv = setInterval(() => setPhase((x) => (x + 1) % PHASES.length), 2000);
      return () => clearInterval(iv);
    }
    let cancelled = false;
    let hold: ReturnType<typeof setTimeout> | undefined;
    let flagTimer: ReturnType<typeof setTimeout> | undefined;
    // The line landed: the end-dot snaps in fast → a subtle beat → the flag DROPS onto it (bloom +
    // haptic), hold, then fade the whole scene out and loop — so nothing snaps away mid-frame.
    const afterDraw = () => {
      if (cancelled) return;
      endDot.value = withSequence(                                  // spawn instantly (0ms)…
        withTiming(1, { duration: 0 }),
        withTiming(1.18, { duration: 180, easing: Easings.bounce }), // …then the same pop-pulse blink as the milestone nodes
        withTiming(1, { duration: 180, easing: Easings.smooth }),
      );
      flagTimer = setTimeout(() => {                                           // subtle pause…
        if (cancelled) return;
        flagPop.value = withSpring(1, Springs.bouncy);                         // …then the flag drops + plants
        bloom.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 700 }));
        fireHaptic();
        hold = setTimeout(() => {
          if (cancelled) return;
          sceneFade.value = withTiming(0, { duration: 400, easing: Easings.smooth }, (fin) => { if (fin) runOnJS(cycle)(); });
        }, 1300);
      }, 220);
    };
    const cycle = () => {
      if (cancelled) return;
      draw.value = 0; startPop.value = 0; n0.value = 0; n1.value = 0; n2.value = 0; endDot.value = 0; flagPop.value = 0; bloom.value = 0;
      hapticGuard.current = false;
      sceneFade.value = withTiming(1, { duration: 250, easing: Easings.smooth });
      startPop.value = withSpring(1, Springs.bouncy);
      draw.value = withTiming(1, { duration: 1800, easing: Easings.smooth }, (fin) => { if (fin) runOnJS(afterDraw)(); });
    };
    cycle();
    const iv = setInterval(() => {
      labelO.value = withTiming(0, { duration: 140 }, (fin) => { if (fin) runOnJS(advancePhase)(); });
    }, 2000);
    return () => {
      cancelled = true;
      if (hold) clearTimeout(hold);
      if (flagTimer) clearTimeout(flagTimer);
      clearInterval(iv);
      [draw, startPop, n0, n1, n2, endDot, flagPop, bloom, sceneFade, labelO].forEach(cancelAnimation);
    };
  }, [reduce]);

  const drawProps = useAnimatedProps(() => ({ strokeDashoffset: PATH_LEN * (1 - draw.value) }));
  const sceneStyle = useAnimatedStyle(() => ({ opacity: sceneFade.value }));
  const startStyle = useAnimatedStyle(() => ({ opacity: Math.min(startPop.value, 1), transform: [{ scale: startPop.value }] }));
  const n0Style = useAnimatedStyle(() => ({ opacity: Math.min(n0.value, 1), transform: [{ scale: n0.value }] }));
  const n1Style = useAnimatedStyle(() => ({ opacity: Math.min(n1.value, 1), transform: [{ scale: n1.value }] }));
  const n2Style = useAnimatedStyle(() => ({ opacity: Math.min(n2.value, 1), transform: [{ scale: n2.value }] }));
  const endDotStyle = useAnimatedStyle(() => ({ opacity: Math.min(endDot.value, 1), transform: [{ scale: endDot.value }] }));
  const flagStyle = useAnimatedStyle(() => ({
    opacity: Math.min(flagPop.value, 1),
    transform: [{ translateY: (1 - Math.min(flagPop.value, 1)) * -16 }, { scale: flagPop.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: bloom.value * 0.5, transform: [{ scale: 0.7 + bloom.value * 0.35 }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelO.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.scene, sceneStyle]}>
        <Svg width={SCENE_W} height={SCENE_H} style={StyleSheet.absoluteFill}>
          <Path d={PATH_D} stroke={Colors.accentContainer} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath d={PATH_D} stroke={Colors.accentSolid} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={PATH_LEN} animatedProps={drawProps} />
        </Svg>

        <Animated.View style={[styles.startMarker, { left: START.x - 6, top: START.y - 6 }, startStyle]} />
        <Text style={[styles.cap, { left: START.x - 16, top: START.y + 8 }]}>Day 0</Text>

        <Animated.View style={[styles.node, { left: NODES[0].x - 7, top: NODES[0].y - 7 }, n0Style]}><View style={styles.nodeDot} /></Animated.View>
        <Animated.View style={[styles.node, { left: NODES[1].x - 7, top: NODES[1].y - 7 }, n1Style]}><View style={styles.nodeDot} /></Animated.View>
        <Animated.View style={[styles.node, { left: NODES[2].x - 7, top: NODES[2].y - 7 }, n2Style]}><View style={styles.nodeDot} /></Animated.View>
        <Text style={[styles.wk, { left: NODES[0].x - 14, top: NODES[0].y + 9 }]}>Wk 4</Text>
        <Text style={[styles.wk, { left: NODES[1].x - 14, top: NODES[1].y + 9 }]}>Wk 8</Text>
        <Text style={[styles.wk, { left: NODES[2].x - 14, top: NODES[2].y + 9 }]}>Wk 12</Text>

        <Animated.View style={[styles.node, styles.goalNode, { left: GOAL.x - 8, top: GOAL.y - 8 }, endDotStyle]}><View style={styles.goalNodeDot} /></Animated.View>

        <Animated.View style={[styles.flagGlow, { left: GOAL.x - 20, top: GOAL.y - 20 }, glowStyle]} />
        <Animated.View style={[styles.flag, { left: GOAL.x - 3, top: GOAL.y - 26 }, flagStyle]}>
          <FlagIcon size={30} color={GOAL_COLOR} />
        </Animated.View>
        <Text style={[styles.cap, styles.capGoal, { left: GOAL.x - 16, top: GOAL.y + 10 }]}>Day 90</Text>
      </Animated.View>

      <Animated.Text style={[styles.phase, labelStyle]}>{PHASES[phase]}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl },
  scene: { width: SCENE_W, height: SCENE_H },
  startMarker: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: Colors.accent, backgroundColor: Colors.background },
  node: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: Colors.accentContainer,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
    shadowColor: Colors.accentSolid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6,
  },
  nodeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accentSolid },
  // the goal marker — same outlined node, slightly larger + a stronger glow (it's the destination)
  goalNode: { width: 16, height: 16, borderRadius: 8, shadowOpacity: 0.95, shadowRadius: 9 },
  goalNodeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentSolid },
  flagGlow: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: GOAL_COLOR,
    shadowColor: GOAL_COLOR, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 11,
  },
  flag: { position: 'absolute' },
  cap: { position: 'absolute', width: 32, textAlign: 'center', fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textTertiary },
  capGoal: { color: Colors.textSecondary },
  wk: { position: 'absolute', width: 28, textAlign: 'center', fontFamily: Typography.fonts.body, fontSize: 9, color: Colors.textTertiary },
  phase: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, textAlign: 'center' },
});
