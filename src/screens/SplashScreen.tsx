import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import { Colors } from '@/theme/colors';

/**
 * In-app loading splash, shown while AuthContext resolves the session.
 *
 * Deliberately mirrors the NATIVE splash (expo-splash-screen): the same logo
 * mark, contain-scaled on the same #19101c background, in the same position —
 * so the native → JS handoff is seamless and the user never sees a second,
 * differently-styled "screen". Only the loading dots fade in to signal work.
 */
export default function SplashScreen() {
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // The logo is already in place (matching the native splash) — don't animate
    // it, or it would flicker against the frame the native splash left behind.
    Animated.timing(dotsOpacity, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Same asset + resizeMode as the native splash → identical placement. */}
      <Image
        source={require('../../assets/splash.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
      />
      <Animated.View style={[styles.loadingRow, { opacity: dotsOpacity }]}>
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
    backgroundColor: Colors.background, // #19101c — matches the native splash
  },
  loadingRow: {
    position: 'absolute',
    bottom: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },
});
