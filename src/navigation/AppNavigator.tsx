import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  HomeIcon as HomeOutline,
  Squares2X2Icon as ToolsOutline,
  UserGroupIcon as CommunityOutline,
} from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeSolid,
  Squares2X2Icon as ToolsSolid,
  UserGroupIcon as CommunitySolid,
} from 'react-native-heroicons/solid';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, MainTabsParamList } from '@/types';
import { Colors, Typography } from '@/theme/colors';
import { Springs } from '@/theme/motion';
import { useAuth } from '@/context/AuthContext';


// Screens
import SplashScreen from '@/screens/SplashScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import LandingScreen from '@/screens/LandingScreen';
import LoginScreen from '@/screens/LoginScreen';
import HomeScreen from '@/screens/HomeScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import ToolsScreen from '@/screens/ToolsScreen';
import ProcessingScreen from '@/screens/ProcessingScreen';
import ResultsScreen from '@/screens/ResultsScreen';
import ActionPlanScreen from '@/screens/ActionPlanScreen';
import DebtPayoffScreen from '@/screens/DebtPayoffScreen';
import ShareScreen from '@/screens/ShareScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import CommunityFeedScreen from '@/screens/CommunityFeedScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import HelpFAQScreen from '@/screens/HelpFAQScreen';
import ScenarioSimulatorScreen from '@/screens/ScenarioSimulatorScreen';
import UsernameSetupScreen from '@/screens/UsernameSetupScreen';
import SubscriptionAuditScreen from '@/screens/SubscriptionAuditScreen';
import AllAnalysesScreen from '@/screens/AllAnalysesScreen';
import FinancialContextScreen from '@/screens/FinancialContextScreen';
import MonthlyCheckInScreen from '@/screens/MonthlyCheckInScreen';
import CreatorDashboardScreen from '@/screens/CreatorDashboardScreen';

import { TAB_BAR_HEIGHT, TAB_ROW_HEIGHT, TAB_FLOAT_MARGIN } from '@/navigation/constants';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

// Modern iOS sheet-style modal (RNScreens UISheetPresentationController): a swipe-down
// sheet with a visible grabber + rounded top, so the user can see it dismisses by drag.
const sheetModal = {
  presentation: 'formSheet' as const,
  sheetGrabberVisible: true,
  sheetAllowedDetents: [0.9] as number[], // ~90% tall — dimmed parent peeks (~10%); grabber forced visible
  sheetCornerRadius: 24,
  // Single detent → no scroll-to-expand. Off lets the inner ScrollView scroll on its
  // own; otherwise the formSheet's gesture eats the scroll when the ScrollView isn't
  // the screen's first child (RNScreens #2687/#3092 — our ScreenBackground is first).
  sheetExpandsWhenScrolledToEdge: false,
};

// UI/navigation chrome → Heroicons (active = solid, inactive = outline). Category/
// decorative icons elsewhere stay on Ionicons (Heroicons doesn't cover them).
const TAB_ICONS: Record<string, { active: React.ComponentType<any>; inactive: React.ComponentType<any> }> = {
  Home:      { active: HomeSolid,      inactive: HomeOutline },
  Tools:     { active: ToolsSolid,     inactive: ToolsOutline },
  Community: { active: CommunitySolid, inactive: CommunityOutline },
};

// Active-indicator pill — a wide, rounded-rectangular magenta sub-pill that slides
// behind the focused icon (Cash-App floating capsule, our brand tint).
const PILL_H = 44;
const PILL_GAP = 24; // horizontal inset of the pill within each slot
const PILL_RADIUS = 16;

// A single icon-only tab. The active icon brightens + springs up a touch; the
// sliding sub-pill (rendered once in the row) is what reads the focus.
function TabBarButton({ route, focused, reduce, onPress }: { route: { name: string }; focused: boolean; reduce: boolean; onPress: () => void }) {
  const icons = TAB_ICONS[route.name];
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = reduce ? 1 : withSpring(focused ? 1.1 : 1, Springs.gentle);
  }, [focused, reduce]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const TabIcon = focused ? icons.active : icons.inactive;

  return (
    <TouchableOpacity
      style={tabStyles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={route.name}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={iconStyle}>
        <TabIcon size={24} color={focused ? Colors.accent : Colors.textSecondary} style={{ opacity: focused ? 1 : 0.6 }} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function IOSTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);
  const slotW = state.routes.length ? rowWidth / state.routes.length : 0;

  // The sub-pill tracks the focused tab. Spring on switch (jump if reduced-motion).
  const indexSV = useSharedValue(state.index);
  useEffect(() => {
    indexSV.value = reduce ? state.index : withSpring(state.index, Springs.snappy);
  }, [state.index, reduce]);

  const pillStyle = useAnimatedStyle(() => {
    const w = Math.max(0, slotW - PILL_GAP);
    return {
      width: w,
      transform: [{ translateX: slotW * indexSV.value + PILL_GAP / 2 }],
      opacity: slotW > 0 ? 1 : 0,
    };
  });

  return (
    <View
      pointerEvents="box-none"
      style={[tabStyles.outerWrapper, { paddingBottom: insets.bottom + TAB_FLOAT_MARGIN }]}
    >
      <View style={tabStyles.capsuleShadow}>
        <BlurView intensity={40} tint="dark" style={tabStyles.capsule}>
          <View
            style={tabStyles.tabRow}
            onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View pointerEvents="none" style={[tabStyles.pill, pillStyle]} />
            {state.routes.map((route, index) => (
              <TabBarButton
                key={route.key}
                route={route}
                focused={state.index === index}
                reduce={reduce}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (state.index !== index && !event.defaultPrevented) {
                    Haptics.selectionAsync();
                    navigation.navigate(route.name);
                  }
                }}
              />
            ))}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <IOSTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'shift' }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Tools" component={ToolsScreen} />
      <Tab.Screen name="Community" component={CommunityFeedScreen} />
    </Tab.Navigator>
  );
}

const sharedHeader = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.accent,
  headerTitleStyle: {
    fontFamily: Typography.fonts.headingSemi,
    fontSize: 17,
    color: Colors.textPrimary,
  },
  headerShadowVisible: false,
  // RN Navigation v7 removed `headerBackTitleVisible`; use display mode instead.
  // 'minimal' = chevron only (no leaked previous-route name like "MainTabs").
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function AppNavigator() {
  const { loading, user, needsUsername, needsOnboarding } = useAuth();

  // Splash while the session restores, or while a signed-in user's first-run
  // gates are still resolving (null = unknown).
  if (loading || (user && (needsUsername === null || needsOnboarding === null))) {
    return <SplashScreen />;
  }

  // Legal pages (Privacy/Terms) are NOT navigator screens — they're shown as a
  // self-contained Modal via LegalContext/LegalSheet (see useLegal). Pushing them as
  // native-stack cards from the auth flow tripped a react-native-screens (New Arch)
  // defect where the 2nd legal screen opened in a session had a dead back button.

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        {!user ? (
          /* ─── Not signed in: AUTH STACK ─── */
          <>
            <Stack.Screen name="Landing" component={LandingScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_bottom' }} />
          </>
        ) : needsUsername ? (
          /* ─── First-run gate: pick a username (mainly OAuth users) ─── */
          <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} options={{ animation: 'fade' }} />
        ) : needsOnboarding ? (
          /* ─── First-run gate: personalization ─── */
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        ) : (
          /* ─── Signed in: APP STACK ─── */
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
            <Stack.Screen name="Analyze" component={HomeScreen} options={{ ...sharedHeader, headerShown: true, title: 'New Roast', animation: 'slide_from_right' }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ ...sharedHeader, headerShown: true, title: 'Trend', animation: 'slide_from_right' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ ...sharedHeader, headerShown: true, title: 'Profile', animation: 'slide_from_right' }} />
            <Stack.Screen name="Processing" component={ProcessingScreen} options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'slide_from_bottom', presentation: 'card', ...sharedHeader, headerShown: true, title: 'Your Results' }} />
            <Stack.Screen name="ActionPlan" component={ActionPlanScreen} options={{ ...sharedHeader, headerShown: true, title: '90-Day Plan', animation: 'slide_from_right' }} />
            <Stack.Screen name="DebtPayoff" component={DebtPayoffScreen} options={{ ...sharedHeader, headerShown: true, title: 'Debt Payoff', animation: 'slide_from_right' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...sharedHeader, headerShown: true, title: 'Settings', animation: 'slide_from_right' }} />
            <Stack.Screen name="FinancialContext" component={FinancialContextScreen} options={{ ...sharedHeader, headerShown: true, title: 'Financial Context', animation: 'slide_from_right' }} />
            <Stack.Screen name="HelpFAQ" component={HelpFAQScreen} options={{ ...sharedHeader, headerShown: true, title: 'Help & FAQ', animation: 'slide_from_right' }} />
            <Stack.Screen name="ScenarioSimulator" component={ScenarioSimulatorScreen} options={{ ...sharedHeader, headerShown: true, title: 'Scenarios', animation: 'slide_from_right' }} />
            <Stack.Screen name="SubscriptionAudit" component={SubscriptionAuditScreen} options={{ ...sharedHeader, headerShown: true, title: 'Subscriptions', animation: 'slide_from_right' }} />
            <Stack.Screen name="AllAnalyses" component={AllAnalysesScreen} options={{ ...sharedHeader, headerShown: true, title: 'All Roasts', animation: 'slide_from_right' }} />
            <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} options={{ ...sharedHeader, headerShown: true, title: 'Creator Dashboard', animation: 'slide_from_right' }} />
            <Stack.Screen name="Share" component={ShareScreen} options={{ ...sheetModal, ...sharedHeader, headerShown: true, title: 'Share Result' }} />
            <Stack.Screen name="Paywall" component={PaywallScreen} options={{ ...sheetModal, headerShown: false }} />
            <Stack.Screen name="MonthlyCheckIn" component={MonthlyCheckInScreen} options={{ ...sheetModal, headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  // Floating capsule: detached from the screen edges, lifted off the safe area.
  // Wide floating capsule: spans most of the width with modest side margins.
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 36,
  },
  capsuleShadow: {
    borderRadius: TAB_ROW_HEIGHT / 2,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  capsule: {
    height: TAB_ROW_HEIGHT,
    borderRadius: TAB_ROW_HEIGHT / 2,
    overflow: 'hidden',
    paddingHorizontal: 6, // breathing room at the rounded ends
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.surfaceElevated,
    elevation: 12,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    height: TAB_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wide rounded-rectangular magenta sub-pill (width is set per-slot at runtime).
  pill: {
    position: 'absolute',
    top: (TAB_ROW_HEIGHT - PILL_H) / 2,
    left: 0,
    height: PILL_H,
    borderRadius: PILL_RADIUS,
    backgroundColor: Colors.accentContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
  },
});
