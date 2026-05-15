import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
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
import { Colors } from './src/theme/colors';

// Keep the splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
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

    loadFonts();
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
