import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';

type Particle = {
  id: string;
  leftPct: number;
  topPct: number;
  size: number;
  opacity: number;
  durationMs: number;
  driftX: number;
  driftY: number;
  color: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const PARTICLE_COLORS = [
  'rgba(189,0,255,0.85)',   // purple
  'rgba(231,0,110,0.85)',   // magenta
  'rgba(0,224,255,0.85)',   // cyan
  'rgba(236,178,255,0.70)', // lavender
  'rgba(185,241,255,0.70)', // light cyan
];

export default function GlobalAnimatedBackdrop() {
  // Three large glowing orbs with independent animations
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0.33)).current;
  const orb3Anim = useRef(new Animated.Value(0.66)).current;

  // Shared particle anim
  const globalAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.timing(orb1Anim, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    );
    const loop2 = Animated.loop(
      Animated.timing(orb2Anim, { toValue: 1, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    );
    const loop3 = Animated.loop(
      Animated.timing(orb3Anim, { toValue: 1, duration: 7500, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    );
    const loopP = Animated.loop(
      Animated.timing(globalAnim, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop1.start();
    loop2.start();
    loop3.start();
    loopP.start();
    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
      loopP.stop();
    };
  }, []);

  const particles = useMemo<Particle[]>(() => {
    const count = 18;
    const baseLeft = [4, 10, 17, 24, 31, 38, 45, 52, 59, 66, 72, 78, 83, 88, 92, 95, 7, 55];
    const baseTop  = [8, 18, 12, 25, 6, 20, 14, 22, 10, 28, 16, 5, 24, 18, 9, 26, 30, 35];
    return Array.from({ length: count }).map((_, i) => ({
      id: `p_${i}`,
      leftPct: baseLeft[i] ?? (i * (100 / count)),
      topPct: baseTop[i] ?? (i * 2),
      size: clamp(14 + (i % 6) * 5, 14, 44),
      opacity: 0.09 + (i % 6) * 0.018,
      durationMs: 7000 + i * 380,
      driftX: (i % 2 === 0 ? 1 : -1) * (6 + (i % 5) * 2.5),
      driftY: (i % 3 === 0 ? 1 : -1) * (8 + (i % 4) * 2),
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    }));
  }, []);

  // Orb 1 — purple, top-left, large slow pulse
  const orb1Scale = orb1Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] });
  const orb1Opacity = orb1Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.13, 0.22, 0.13] });
  const orb1Y = orb1Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -18, 0] });

  // Orb 2 — magenta/pink, top-right, medium pulse
  const orb2Scale = orb2Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.12, 0.9] });
  const orb2Opacity = orb2Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.18, 0.10] });
  const orb2Y = orb2Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 14, 0] });

  // Orb 3 — cyan, bottom-center, fast tight pulse
  const orb3Scale = orb3Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });
  const orb3Opacity = orb3Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.07, 0.14, 0.07] });
  const orb3X = orb3Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 22, 0] });

  return (
    <View pointerEvents="none" style={styles.root}>
      {/* Dark gradient base */}
      <LinearGradient
        colors={['rgba(25,16,28,1)', 'rgba(20,8,38,1)', 'rgba(25,16,28,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Orb 1 — purple, top-left */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          {
            opacity: orb1Opacity as any,
            transform: [{ scale: orb1Scale as any }, { translateY: orb1Y as any }],
          },
        ]}
      >
        <LinearGradient
          colors={['#bd00ff', '#7c00cc']}
          style={styles.orbGradient}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
      </Animated.View>

      {/* Orb 2 — magenta, top-right */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          {
            opacity: orb2Opacity as any,
            transform: [{ scale: orb2Scale as any }, { translateY: orb2Y as any }],
          },
        ]}
      >
        <LinearGradient
          colors={['#e7006e', '#bd00ff']}
          style={styles.orbGradient}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
      </Animated.View>

      {/* Orb 3 — cyan, bottom-center */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb3,
          {
            opacity: orb3Opacity as any,
            transform: [{ scale: orb3Scale as any }, { translateX: orb3X as any }],
          },
        ]}
      >
        <LinearGradient
          colors={['#00e0ff', '#0060cc']}
          style={styles.orbGradient}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
      </Animated.View>

      {/* Floating micro-particles */}
      {particles.map((p) => {
        const tx = globalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.driftX] });
        const ty = globalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.driftY] });
        const op = globalAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [p.opacity * 0.5, p.opacity * 1.4, p.opacity * 0.6],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particleWrap,
              {
                left: `${p.leftPct}%`,
                top: `${p.topPct}%`,
                width: p.size,
                height: p.size,
                opacity: op as any,
                transform: [{ translateX: tx as any }, { translateY: ty as any }],
                marginLeft: -p.size / 2,
              },
            ]}
          >
            <View
              style={{
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
              }}
            />
          </Animated.View>
        );
      })}

      {/* Subtle top haze */}
      <View style={styles.topHaze} />
      {/* Bottom tint */}
      <View style={styles.bottomTint} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  orb1: {
    width: 320,
    height: 320,
    top: -100,
    left: -80,
  },
  orb2: {
    width: 260,
    height: 260,
    top: -60,
    right: -60,
  },
  orb3: {
    width: 300,
    height: 300,
    bottom: -100,
    alignSelf: 'center',
    left: '20%',
  },
  orbGradient: {
    width: '100%',
    height: '100%',
  },
  particleWrap: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHaze: {
    position: 'absolute',
    top: -80,
    left: -40,
    right: -40,
    height: 280,
    borderRadius: 200,
    backgroundColor: 'rgba(189,0,255,0.04)',
  },
  bottomTint: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    right: -40,
    height: 200,
    borderRadius: 160,
    backgroundColor: 'rgba(0,224,255,0.035)',
  },
});
