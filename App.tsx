import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, LogBox } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
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
import { LegalProvider } from './src/context/LegalContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Colors } from './src/theme/colors';
import { initAnalytics } from './src/services/analytics';
import { configurePurchases } from './src/services/purchases';
import { loadHapticsPref } from './src/utils/haptics';
import BiometricLockGate from './src/components/BiometricLockGate';

// Suppress the in-app LogBox warning overlay in dev. The simulator warnings here
// are known-benign noise (see CLAUDE.md "Gotchas") and the overlay sits over the
// bottom tab bar. Dev-only — never ships (release builds are __DEV__ === false).
// Errors still surface; remove this line to bring warning toasts back during QA.
if (__DEV__) LogBox.ignoreAllLogs();

// Keep the splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

// Route taps on a local notification (e.g. the monthly check-in reminder) to the
// screen named in its data payload. Queues the target if the navigator isn't ready
// yet (cold start from a tapped notification).
const navigationRef = createNavigationContainerRef<any>();
let pendingNavScreen: string | null = null;

function routeFromNotification(resp: Notifications.NotificationResponse | null) {
  const screen = (resp?.notification?.request?.content?.data as any)?.screen;
  if (!screen) return;
  if (navigationRef.isReady()) {
    try { navigationRef.navigate(screen as never); } catch { /* route not available in current gate */ }
  } else {
    pendingNavScreen = screen;
  }
}

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
    loadHapticsPref();
    initAnalytics().catch(() => {});
    // Configure RevenueCat anonymously at startup; AuthContext calls logIn once
    // the user is known so purchases map to the Supabase user id.
    configurePurchases();

    // Handle taps on local notifications (running + cold start).
    const sub = Notifications.addNotificationResponseReceivedListener(routeFromNotification);
    Notifications.getLastNotificationResponseAsync().then(routeFromNotification).catch(() => {});
    return () => sub.remove();
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
      <LegalProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          if (pendingNavScreen) {
            try { navigationRef.navigate(pendingNavScreen as never); } catch { /* gate */ }
            pendingNavScreen = null;
          }
        }}
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
        <BiometricLockGate>
          <AppNavigator />
        </BiometricLockGate>
      </NavigationContainer>
      </LegalProvider>
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
