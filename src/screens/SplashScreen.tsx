import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { Colors } from '@/theme/colors';

// Match the native splash: splash.png is `contain`-scaled to the screen width,
// so a full-width square here renders the mark at the same size and (via
// centering) the same position. NOTE: don't use absoluteFill for the Image —
// on RN 0.83/Fabric it renders without proper bounds and the logo blows up in
// the corner; an explicit size is required.
const LOGO_SIZE = Dimensions.get('window').width;

/**
 * In-app loading splash, shown while AuthContext resolves the session.
 *
 * Intentionally identical to the native expo-splash-screen frame — just the
 * logo mark on the dark background — so the native → JS handoff is seamless and
 * invisible. No spinner: per Apple's launch-screen guidance an indicator makes
 * the (brief) wait feel slower, and the session usually resolves immediately.
 */
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/splash.png')}
        style={styles.logo}
        resizeMode="contain"
      />
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
});
