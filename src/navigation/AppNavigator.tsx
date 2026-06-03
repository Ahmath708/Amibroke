import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  HomeIcon as HomeOutline,
  WrenchScrewdriverIcon as WrenchOutline,
  ChatBubbleLeftRightIcon as ChatOutline,
} from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeSolid,
  WrenchScrewdriverIcon as WrenchSolid,
  ChatBubbleLeftRightIcon as ChatSolid,
} from 'react-native-heroicons/solid';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, MainTabsParamList } from '@/types';
import { Colors, Spacing, Typography } from '@/theme/colors';
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

import { TAB_BAR_HEIGHT } from '@/navigation/constants';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

// UI/navigation chrome → Heroicons (active = solid, inactive = outline). Category/
// decorative icons elsewhere stay on Ionicons (Heroicons doesn't cover them).
const TAB_ICONS: Record<string, { active: React.ComponentType<any>; inactive: React.ComponentType<any> }> = {
  Home:      { active: HomeSolid,   inactive: HomeOutline },
  Tools:     { active: WrenchSolid, inactive: WrenchOutline },
  Community: { active: ChatSolid,   inactive: ChatOutline },
};

function IOSTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = TAB_BAR_HEIGHT;

  return (
    <View style={[tabStyles.outerWrapper, { paddingBottom: insets.bottom }]}>
      <BlurView intensity={85} tint="dark" style={tabStyles.blurFill}>
        <View style={tabStyles.separator} />
        <View style={[tabStyles.tabRow, { height: TAB_HEIGHT }]}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const icons = TAB_ICONS[route.name];

            return (
              <TouchableOpacity
                key={route.key}
                style={tabStyles.tabItem}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                activeOpacity={0.7}
              >
                {(() => {
                  const TabIcon = focused ? icons.active : icons.inactive;
                  return (
                    <TabIcon
                      size={22}
                      color={focused ? Colors.tint : Colors.textSecondary}
                      style={{ opacity: focused ? 1 : 0.55 }}
                    />
                  );
                })()}
                <Text style={[tabStyles.tabLabel, focused && tabStyles.tabLabelActive]}>
                  {route.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <IOSTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Tools" component={ToolsScreen} />
      <Tab.Screen name="Community" component={CommunityFeedScreen} />
    </Tab.Navigator>
  );
}

const sharedHeader = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.tint,
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
            <Stack.Screen name="Share" component={ShareScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', ...sharedHeader, headerShown: true, title: 'Share Result' }} />
            <Stack.Screen name="Paywall" component={PaywallScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="MonthlyCheckIn" component={MonthlyCheckInScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', ...sharedHeader, headerShown: true, title: 'Monthly Check-In' }} />
          </>
        )}
      </Stack.Navigator>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  blurFill: { overflow: 'hidden' },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  tabIcon: {},
  tabLabel: {
    fontFamily: Typography.fonts.body,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: Colors.tint,
    fontFamily: Typography.fonts.bodyMed,
  },
});
