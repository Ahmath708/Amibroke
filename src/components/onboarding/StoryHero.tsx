// Act 1 (Story) hero visuals for onboarding — Claude Design rebuild (ref:
// docs/redesign/claude-design/Am I Broke - Onboarding.html, HeroPeel/HeroDial/HeroBloom).
//   peel  — a "Checking balance" comfort card peels away (3D flip) to reveal the real debt beneath.
//   dial  — a neon comet sweeps a gauge that never settles ("? /100" — the score, still forming).
//   bloom — five magenta bars rise, staggered ("watch your real score build").
// Entrance + idle motion on the UI thread; static under reduced motion. Disciplined-neon tokens.
import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming, withRepeat,
  withDelay, interpolate, runOnJS, useReducedMotion, Easing,
} from 'react-native-reanimated';
import { Colors, Typography } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type StoryScene = 'peel' | 'dial' | 'bloom';

// Hero illustration literals (between canvas + card; faithful to the reference HTML).
const TRUTH_BG = '#111119';
const COMFORT_TOP = '#20202b';
const COMFORT_BOT = '#181820';

export default function StoryHero({ scene }: { scene: StoryScene }) {
  if (scene === 'peel') return <Peel />;
  if (scene === 'dial') return <Dial />;
  return <Bloom />;
}

// ── Scene 1 · peel ── the comfort card flips up and away, exposing the real number underneath.
function Peel() {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0); // peel progress
  const glow = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) { p.value = 1; glow.value = 1; return; }
    p.value = withDelay(1150, withTiming(1, { duration: 1500, easing: Easing.bezier(0.55, 0, 0.2, 1) }));
    glow.value = withDelay(1250, withTiming(1, { duration: 1000 }));
  }, [reduce]);

  const comfortStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.55, 1], [1, 1, 0]),
    transform: [
      { perspective: 950 },
      { translateY: -30 * p.value },
      { rotateX: `${-120 * p.value}deg` },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={styles.heroBox}>
      <View style={styles.peelStack}>
        <Animated.View style={[styles.peelGlow, glowStyle]} />
        {/* truth card (underneath) */}
        <View style={[styles.peelCard, styles.truthCard]}>
          <Text style={styles.peelLbl}>What you actually owe</Text>
          <Text style={styles.truthVal}>−$9,800</Text>
          <Text style={styles.truthSub}>leaking $214/mo in interest</Text>
          <Leak left="30%" delay={2400} reduce={reduce} />
          <Leak left="50%" delay={3000} reduce={reduce} />
          <Leak left="70%" delay={3600} reduce={reduce} />
        </View>
        {/* comfort card (on top — peels away) */}
        <Animated.View style={[styles.peelCard, styles.comfortCard, comfortStyle]}>
          <LinearGradient colors={[COMFORT_TOP, COMFORT_BOT]} style={StyleSheet.absoluteFill} />
          <Text style={styles.peelLbl}>Checking balance</Text>
          <Text style={styles.comfortVal}>$2,847.00</Text>
        </Animated.View>
      </View>
    </View>
  );
}

function Leak({ left, delay, reduce }: { left: string; delay: number; reduce: boolean }) {
  const d = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    d.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.in(Easing.quad) }), -1, false));
  }, [reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(d.value, [0, 0.22, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(d.value, [0, 1], [-28, 6]) }, { scale: interpolate(d.value, [0, 1], [0.5, 0.85]) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.leak, { left: left as unknown as number }, style]} />;
}

// ── Scene 2 · dial ── an indeterminate "calculating a score" gauge (same comet-tip mechanic as the
// Landing AnalyzingHero). The arc is pinned at 12 o'clock and elongates to a RANDOM target — a white
// comet tip leading the head — as if landing on a score, then the whole arc fades out and restarts
// with a new target. It never settles: the center stays "? /100".
const DIAL_C = 2 * Math.PI * 82; // ≈ 515 (r=82)
function Dial() {
  const reduce = useReducedMotion();
  const len = useSharedValue(0);   // current arc length in px (0..DIAL_C)
  const arcOp = useSharedValue(1); // arc fade (fades out on "land", back in on restart)
  const tipOp = useSharedValue(0); // comet-tip opacity (on while sweeping, off on land)

  const runCycle = useCallback(() => {
    const target = (0.30 + Math.random() * 0.62) * DIAL_C; // land somewhere in 30–92%
    arcOp.value = 1;
    tipOp.value = 1;
    len.value = 0;
    len.value = withTiming(target, { duration: 1150, easing: Easing.out(Easing.cubic) }, (finished) => {
      'worklet';
      if (!finished) return;
      tipOp.value = withTiming(0, { duration: 320 });                    // tip lands + fades
      arcOp.value = withDelay(260, withTiming(0, { duration: 460 }, (f) => { // then the arc dissolves
        'worklet';
        if (f) runOnJS(runCycle)();                                      // …and starts over
      }));
    });
  }, []);

  useEffect(() => {
    if (reduce) { len.value = 0.62 * DIAL_C; arcOp.value = 1; tipOp.value = 0; return; }
    runCycle();
  }, [reduce]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: DIAL_C - len.value }));
  const arcFade = useAnimatedStyle(() => ({ opacity: arcOp.value }));
  const tipStyle = useAnimatedStyle(() => ({
    opacity: tipOp.value * arcOp.value,
    transform: [{ rotate: `${(len.value / DIAL_C) * 360}deg` }],
  }));

  return (
    <View style={styles.heroBox}>
      <View style={styles.dialBox}>
        {/* static muted track */}
        <Svg width={226} height={226} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
          <Circle cx={100} cy={100} r={82} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
        </Svg>
        {/* the elongating arc — pinned at 12 o'clock (rotate -90), growing clockwise */}
        <Animated.View style={[StyleSheet.absoluteFill, arcFade]}>
          <Svg width={226} height={226} viewBox="0 0 200 200">
            <AnimatedCircle
              cx={100} cy={100} r={82} fill="none" stroke={Colors.accentSolid} strokeWidth={9}
              strokeLinecap="round" strokeDasharray={DIAL_C} rotation={-90} origin="100, 100"
              animatedProps={arcProps}
            />
          </Svg>
        </Animated.View>
        {/* comet tip at the arc head (rotated to the leading edge) */}
        <Animated.View style={[StyleSheet.absoluteFill, tipStyle]}>
          <Svg width={226} height={226} viewBox="0 0 200 200">
            <Circle cx={100} cy={18} r={9} fill="#fff" opacity={0.2} />
            <Circle cx={100} cy={18} r={5.5} fill="#fff" />
          </Svg>
        </Animated.View>
        <View style={styles.dialCenter}>
          <Text style={styles.dialQ}>?</Text>
          <Text style={styles.dialOut}>/100</Text>
        </View>
      </View>
    </View>
  );
}

// ── Scene 3 · bloom ── five bars rise on a stagger over a soft neon glow.
function Bloom() {
  const reduce = useReducedMotion();
  const heights = [46, 80, 114, 150, 196];
  return (
    <View style={styles.heroBox}>
      <View style={styles.bloomRow}>
        {heights.map((h, i) => <Bar key={i} h={h} delay={150 + i * 120} reduce={reduce} />)}
      </View>
    </View>
  );
}

function Bar({ h, delay, reduce }: { h: number; delay: number; reduce: boolean }) {
  const s = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { s.value = 1; return; }
    s.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return (
    <Animated.View style={[styles.bar, { height: h }, style]}>
      <LinearGradient colors={['#FF2E9A', 'rgba(255,0,122,0.42)']} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const HERO = 248;
const styles = StyleSheet.create({
  heroBox: { width: '100%', height: HERO, alignItems: 'center', justifyContent: 'center' },

  // ── peel ──
  peelStack: { width: 288, height: 212 },
  peelGlow: { position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%', borderRadius: 999, backgroundColor: Colors.accent, opacity: 0, shadowColor: Colors.accentSolid, shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  peelCard: { position: 'absolute', left: 6, right: 6, top: 0, bottom: 0, borderRadius: 24, paddingHorizontal: 26, paddingTop: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, overflow: 'hidden' },
  truthCard: { backgroundColor: TRUTH_BG },
  comfortCard: { transformOrigin: 'center bottom', shadowColor: '#000', shadowOpacity: 0.75, shadowRadius: 22, shadowOffset: { width: 0, height: 22 } },
  peelLbl: { fontFamily: Typography.fonts.bodySemi, fontSize: 12.5, color: Colors.textSecondary, letterSpacing: 0.2 },
  truthVal: { marginTop: 10, fontFamily: Typography.fonts.monoSemi, fontSize: 39, letterSpacing: -1.8, color: Colors.accentSolid },
  truthSub: { marginTop: 4, fontFamily: Typography.fonts.bodySemi, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.2 },
  comfortVal: { marginTop: 10, fontFamily: Typography.fonts.monoSemi, fontSize: 39, letterSpacing: -1.8, color: Colors.textPrimary },
  leak: { position: 'absolute', bottom: 18, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentSolid, shadowColor: Colors.accentSolid, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },

  // ── dial ──
  dialBox: { width: 226, height: 226, alignItems: 'center', justifyContent: 'center' },
  dialCenter: { position: 'absolute', alignItems: 'center' },
  dialQ: { fontFamily: Typography.fonts.extrabold, fontSize: 50, letterSpacing: -2, lineHeight: 52, color: Colors.textPrimary },
  dialOut: { marginTop: 5, fontFamily: Typography.fonts.monoSemi, fontSize: 13, color: Colors.textTertiary },

  // ── bloom ──
  bloomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 13 },
  bar: { width: 26, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, transformOrigin: 'bottom', overflow: 'hidden' },
});
