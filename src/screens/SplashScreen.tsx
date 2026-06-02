import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Image } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';

export default function SplashScreen() {
  const scale = useRef(new Animated.Value(0.75)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(0.5)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance: glow → logo → text → tagline → ring pulse
    Animated.sequence([
      // Glow blooms first
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.28, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      // Logo springs in
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      // App name fades in
      Animated.timing(textOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
      // Tagline slides in
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      // After everything loads, pulse the ring
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ring1Scale, { toValue: 1.6, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(ring1Opacity, { toValue: 0.18, duration: 400, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ring1Opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
          Animated.timing(ring1Scale, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <ScreenBackground variant="splash" />
      {/* Background orbs */}
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      {/* Pulsing ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            opacity: ring1Opacity,
            transform: [{ scale: ring1Scale }],
          },
        ]}
      />

      {/* Glow bloom */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }], opacity }]}>
        <Image source={require('../../assets/logo-mark.png')} style={styles.logoImage} resizeMode="contain" />
      </Animated.View>

      {/* Text group */}
      <View style={styles.textGroup}>
        <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>
          Am I Broke?
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Financial clarity, brutally delivered.
        </Animated.Text>
      </View>

      {/* Loading dots */}
      <Animated.View style={[styles.loadingRow, { opacity: taglineOpacity }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { opacity: 0.4 + i * 0.2 }]} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.xl,
  },
  bgOrbTop: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(189,0,255,0.07)',
    top: -100,
    left: -80,
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0,224,255,0.05)',
    bottom: -80,
    right: -60,
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: Colors.primarySolid,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primarySolid,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primarySolid,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  textGroup: { alignItems: 'center', gap: Spacing.xs },
  appName: {
    fontFamily: Typography.fonts.heading,
    fontSize: Typography.largeTitle.fontSize,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  tagline: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary,
  },
  loadingRow: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
});
