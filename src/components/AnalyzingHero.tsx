import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** One generated analysis: a score and a sparkline that tracks it. */
type Sample = { score: number; points: number[] };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/**
 * Score range per band, aligned to getScoreBand's boundaries. We cycle through
 * all four (instead of pure 1–100) so the teaser shows a balanced spread — pure
 * random would land in the red band 40% of the time and could repeat a colour.
 * Fragile is floored at 12 so even the red sample draws a real arc (a "3" looks
 * like an empty/broken ring).
 */
const BAND_RANGES: { min: number; max: number }[] = [
  { min: 12, max: 40 },  // Financially Fragile (red)
  { min: 41, max: 60 },  // Surviving (amber)
  { min: 61, max: 80 },  // Stable (teal)
  { min: 81, max: 100 }, // Thriving (green)
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A trend line that tracks the score: low scores fall, high scores rise. */
function buildPoints(score: number): number[] {
  const slope = score / 100 - 0.5; // -0.49 (falling) .. +0.5 (rising)
  const start = clamp(0.5 - slope, 0.1, 0.9);
  const end = clamp(0.5 + slope, 0.1, 0.9);
  return Array.from({ length: 6 }, (_, i) => {
    const t = i / 5;
    const jitter = (Math.random() - 0.5) * 0.22;
    return clamp(start + (end - start) * t + jitter, 0.06, 0.94);
  });
}

function sampleForBand(bandIndex: number): Sample {
  const { min, max } = BAND_RANGES[bandIndex];
  const score = randInt(min, max);
  return { score, points: buildPoints(score) };
}

const RING = 78;
const STROKE = RING * 0.1;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const CHART_H = 48;
const DRAW_MS = 1500;
const HOLD_MS = 1500;
const FADE_MS = 350;
const DASH = 800; // any length >= the sparkline path length

/**
 * Looping "fintech analyzing" hero: a score ring sweeps up while a trend line
 * draws itself left-to-right, cycling through sample outcomes (red→amber→green).
 * Fully self-contained — drop it in and it runs.
 */
export default function AnalyzingHero() {
  const progress = useRef(new Animated.Value(0)).current; // 0→1 drives ring + line
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const bag = useRef<number[]>([]);          // remaining band indices this round
  const lastBand = useRef<number | null>(null);

  // Draw the next band from a shuffled bag — each band once per round, never the
  // same band twice in a row (including across the round boundary).
  function nextSample(): Sample {
    if (bag.current.length === 0) {
      const order = shuffle([0, 1, 2, 3]);
      if (order[0] === lastBand.current && order.length > 1) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      bag.current = order;
    }
    const idx = bag.current.shift()!;
    lastBand.current = idx;
    return sampleForBand(idx);
  }

  const [sample, setSample] = useState<Sample>(() => nextSample());
  const [chartW, setChartW] = useState(0);
  const [display, setDisplay] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);

  const band = getScoreBand(sample.score);

  // Count-up number, derived from the same driver as the arc.
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      setDisplay((prev) => {
        const next = Math.round(value * sample.score);
        return next === prev ? prev : next;
      });
    });
    return () => progress.removeListener(id);
  }, [progress, sample.score]);

  // The loop: draw → hold → fade out → advance sample → fade in → repeat.
  useEffect(() => {
    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;

    function runCycle() {
      if (cancelled) return;
      progress.setValue(0);
      setAnalyzing(true);
      cardOpacity.setValue(1);
      Animated.timing(progress, {
        toValue: 1,
        duration: DRAW_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        setAnalyzing(false);
        holdTimer = setTimeout(() => {
          if (cancelled) return;
          Animated.timing(cardOpacity, {
            toValue: 0,
            duration: FADE_MS,
            useNativeDriver: true,
          }).start(({ finished: f }) => {
            if (!f || cancelled) return;
            setSample(nextSample()); // next band from the bag; triggers re-run via effect dep
          });
        }, HOLD_MS);
      });
    }

    runCycle();
    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      progress.stopAnimation();
      cardOpacity.stopAnimation();
    };
  }, [sample, progress, cardOpacity]);

  const onChartLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  // Sparkline path (built once we know the available width).
  const pathD = (() => {
    if (chartW <= 0) return '';
    const pts = sample.points;
    const stepX = chartW / (pts.length - 1);
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${((1 - p) * CHART_H).toFixed(1)}`)
      .join(' ');
  })();

  const ringOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRC, CIRC * (1 - sample.score / 100)],
  });
  const lineOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [DASH, 0] });

  return (
    <Animated.View style={[styles.card, { opacity: cardOpacity }]}>
      {/* Score ring */}
      <View style={styles.ringWrap}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={Colors.backgroundSecondary} strokeWidth={STROKE} />
          <AnimatedCircle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke={band.color}
            strokeWidth={STROKE}
            strokeDasharray={CIRC}
            strokeDashoffset={ringOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.ringCenter}>
            <Text style={[styles.scoreNum, { color: band.color }]}>{display}</Text>
          </View>
        </View>
      </View>

      {/* Trend + status */}
      <View style={styles.right}>
        <Text style={styles.status} numberOfLines={1}>
          {analyzing ? (
            <Text style={styles.analyzing}>Analyzing…</Text>
          ) : (
            <Text style={[styles.statusValue, { color: band.color }]}>{band.label}</Text>
          )}
        </Text>
        <View style={styles.chart} onLayout={onChartLayout}>
          {pathD ? (
            <Svg width={chartW} height={CHART_H}>
              <AnimatedPath
                d={pathD}
                fill="none"
                stroke={band.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={DASH}
                strokeDashoffset={lineOffset}
              />
            </Svg>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
    padding: Spacing.md,
  },
  ringWrap: { width: RING, height: RING },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreNum: {
    fontFamily: Typography.fonts.heading,
    fontWeight: '700',
    fontSize: RING * 0.32,
    letterSpacing: -1,
  },
  right: { flex: 1, justifyContent: 'center', gap: Spacing.sm },
  status: { fontFamily: Typography.fonts.body },
  analyzing: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary,
  },
  statusValue: {
    fontFamily: Typography.fonts.headingSemi,
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  chart: { height: CHART_H, width: '100%' },
});
