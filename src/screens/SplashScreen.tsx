import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import { Colors } from '@/theme/colors';

// Match the native splash: the splash.png square is `contain`-scaled to the
// screen width, so a full-width square here renders the mark at the same size
// and (via centering) the same position. NOTE: don't use absoluteFill for the
// Image — on RN 0.83/Fabric it renders without proper bounds and the logo blows
// up in the corner; an explicit size is required.
const LOGO_SIZE = Dimensions.get('window').width;

/**
 * In-app loading splash, shown while AuthContext resolves the session.
 * Deliberately mirrors the native expo-splash-screen frame (same mark, same
 * dark background, same size/position) so the native → JS handoff is seamless.
 */
export default function SplashScreen() {
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(dotsOpacity, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/splash.png')}
        style={styles.logo}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background, // #19101c — matches the native splash
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  loadingRow: {
    position: 'absolute',
    bottom: 64,
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
