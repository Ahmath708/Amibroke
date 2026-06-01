import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Colors } from './src/theme/colors';
import { initAnalytics } from './src/services/analytics';
import { configurePurchases } from './src/services/purchases';

// Suppress the in-app LogBox warning overlay in dev. The simulator warnings here
// are known-benign noise (see CLAUDE.md "Gotchas") and the overlay sits over the
// bottom tab bar. Dev-only — never ships (release builds are __DEV__ === false).
// Errors still surface; remove this line to bring warning toasts back during QA.
if (__DEV__) LogBox.ignoreAllLogs();

// Keep the splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        await Font.loadAsync({
          SpaceGrotesk_400Regular,
          SpaceGrotesk_500Medium,
          SpaceGrotesk_600SemiBold,
          SpaceGrotesk_700Bold,
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
        });
      } catch (e) {
        console.warn('Font loading error:', e);
      } finally {
        setFontsLoaded(true);
        await SplashScreen.hideAsync();
      }
    }

    bootstrap();
    initAnalytics().catch(() => {});
    // Configure RevenueCat anonymously at startup; AuthContext calls logIn once
    // the user is known so purchases map to the Supabase user id.
    configurePurchases();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.background}
        translucent
      />
      <AuthProvider>
      <ErrorBoundary>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: Colors.primary,
            background: Colors.background,
            card: Colors.surface,
            text: Colors.textPrimary,
            border: 'rgba(255,255,255,0.1)',
            notification: Colors.primary,
          },
          fonts: {
            regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
            medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
            bold: { fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '700' },
            heavy: { fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '900' },
          },
        }}
      >
        <AppNavigator />
      </NavigationContainer>
      </ErrorBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
