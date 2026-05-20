import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '@/types';
import { Colors, Spacing, Typography } from '@/theme/colors';

// Screens
import SplashScreen from '@/screens/SplashScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import LandingScreen from '@/screens/LandingScreen';
import LoginScreen from '@/screens/LoginScreen';
import HomeScreen from '@/screens/HomeScreen';
import ProcessingScreen from '@/screens/ProcessingScreen';
import ResultsScreen from '@/screens/ResultsScreen';
import ActionPlanScreen from '@/screens/ActionPlanScreen';
import DebtPayoffScreen from '@/screens/DebtPayoffScreen';
import ShareScreen from '@/screens/ShareScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import PaymentScreen from '@/screens/PaymentScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import CommunityFeedScreen from '@/screens/CommunityFeedScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '@/screens/TermsOfServiceScreen';
import HelpFAQScreen from '@/screens/HelpFAQScreen';
import ScenarioSimulatorScreen from '@/screens/ScenarioSimulatorScreen';
import SubscriptionAuditScreen from '@/screens/SubscriptionAuditScreen';
import AffiliateScreen from '@/screens/AffiliateScreen';
import MonthlyCheckInScreen from '@/screens/MonthlyCheckInScreen';
import CreatorDashboardScreen from '@/screens/CreatorDashboardScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// ── iOS-style Tab Icons ────────────────────────────────────────────────────────
const TAB_CONFIG = [
  { name: 'Home',      label: 'Home',      icon: '⬜',  activeIcon: '■'  },
  { name: 'History',   label: 'History',   icon: '☆',   activeIcon: '★'  },
  { name: 'Community', label: 'Community', icon: '○',   activeIcon: '●'  },
  { name: 'Profile',   label: 'Profile',   icon: '◻',   activeIcon: '◼'  },
];

// SF Symbol–style icons using text (in production use react-native-sf-symbols or similar)
const ICONS: Record<string, { active: string; inactive: string }> = {
  Home:      { active: '🏠', inactive: '🏠' },
  History:   { active: '📊', inactive: '📊' },
  Community: { active: '💬', inactive: '💬' },
  Profile:   { active: '👤', inactive: '👤' },
};

function IOSTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = 49;

  return (
    <View style={[tabStyles.outerWrapper, { paddingBottom: insets.bottom }]}>
      <BlurView intensity={85} tint="dark" style={tabStyles.blurFill}>
        <View style={tabStyles.separator} />
        <View style={[tabStyles.tabRow, { height: TAB_HEIGHT }]}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const icon = ICONS[route.name];

            return (
              <View
                key={route.key}
                style={tabStyles.tabItem}
              >
                <Text
                  style={[tabStyles.tabIcon, { opacity: focused ? 1 : 0.45 }]}
                  onPress={() => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                  }}
                >
                  {focused ? icon.active : icon.inactive}
                </Text>
                <Text style={[tabStyles.tabLabel, focused && tabStyles.tabLabelActive]}>
                  {route.name}
                </Text>
              </View>
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Community" component={CommunityFeedScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ── Shared header style ────────────────────────────────────────────────────────
const iosHeaderStyle = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.tint,
  headerTitleStyle: {
    fontFamily: Typography.fonts.headingSemi,
    fontSize: 17,
    color: Colors.textPrimary,
  },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: Colors.background },
} as const;

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Landing" component={LandingScreen} options={{ animation: 'fade', headerShown: false }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="Home" component={MainTabs} options={{ animation: 'fade' }} />

      {/* Push screens */}
      <Stack.Screen name="Processing" component={ProcessingScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'slide_from_bottom', presentation: 'card', ...iosHeaderStyle, headerShown: true, title: 'Your Results' }} />
      <Stack.Screen name="ActionPlan" component={ActionPlanScreen} options={{ ...iosHeaderStyle, headerShown: true, title: '90-Day Plan', animation: 'slide_from_right' }} />
      <Stack.Screen name="DebtPayoff" component={DebtPayoffScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Debt Payoff', animation: 'slide_from_right' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Settings', animation: 'slide_from_right' }} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Privacy Policy', animation: 'slide_from_right' }} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Terms of Service', animation: 'slide_from_right' }} />
      <Stack.Screen name="HelpFAQ" component={HelpFAQScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Help & FAQ', animation: 'slide_from_right' }} />
      <Stack.Screen name="ScenarioSimulator" component={ScenarioSimulatorScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Scenarios', animation: 'slide_from_right' }} />
      <Stack.Screen name="SubscriptionAudit" component={SubscriptionAuditScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Subscriptions', animation: 'slide_from_right' }} />
      <Stack.Screen name="Affiliate" component={AffiliateScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Recommendations', animation: 'slide_from_right' }} />
      <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} options={{ ...iosHeaderStyle, headerShown: true, title: 'Creator Dashboard', animation: 'slide_from_right' }} />

      {/* Modal sheets */}
      <Stack.Screen name="Share" component={ShareScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', ...iosHeaderStyle, headerShown: true, title: 'Share' }} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', ...iosHeaderStyle, headerShown: true, title: 'Upgrade' }} />
      <Stack.Screen name="MonthlyCheckIn" component={MonthlyCheckInScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', ...iosHeaderStyle, headerShown: true, title: 'Monthly Check-In' }} />
    </Stack.Navigator>
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
  tabIcon: { fontSize: 22 },
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
