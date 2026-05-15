import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography } from '../theme/colors';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'> };

export default function SplashScreen({ navigation }: Props) {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 350, delay: 100, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }], opacity }]}>
        <LinearGradient
          colors={Colors.gradientPrimary}
          style={styles.logoCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.logoEmoji}>💸</Text>
        </LinearGradient>
        {/* Bloom glow */}
        <View style={styles.bloom} />
      </Animated.View>

      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={styles.appName}>Am I Broke?</Text>
        <Text style={styles.tagline}>Financial clarity, brutally delivered.</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 },
  logoWrap: { alignItems: 'center', justifyContent: 'center' },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primarySolid,
    opacity: 0.18,
    zIndex: -1,
  },
  logoEmoji: { fontSize: 44 },
  appName: {
    fontFamily: Typography.fonts.heading,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Typography.fonts.body,
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
  },
});
