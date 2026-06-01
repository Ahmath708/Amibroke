import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '@/types';
import { Colors, Spacing, Typography } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';


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
import HistoryScreen from '@/screens/HistoryScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import CommunityFeedScreen from '@/screens/CommunityFeedScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '@/screens/TermsOfServiceScreen';
import HelpFAQScreen from '@/screens/HelpFAQScreen';
import ScenarioSimulatorScreen from '@/screens/ScenarioSimulatorScreen';
import UsernameSetupScreen from '@/screens/UsernameSetupScreen';
import SubscriptionAuditScreen from '@/screens/SubscriptionAuditScreen';
import MonthlyCheckInScreen from '@/screens/MonthlyCheckInScreen';
import CreatorDashboardScreen from '@/screens/CreatorDashboardScreen';

import { TAB_BAR_HEIGHT } from '@/navigation/constants';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Home:      { active: 'home',        inactive: 'home-outline' },
  History:   { active: 'stats-chart', inactive: 'stats-chart-outline' },
  Community: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Profile:   { active: 'person',      inactive: 'person-outline' },
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
                <Ionicons
                  name={focused ? icons.active : icons.inactive}
                  size={22}
                  color={focused ? Colors.tint : Colors.textSecondary}
                  style={{ opacity: focused ? 1 : 0.55 }}
                />
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Community" component={CommunityFeedScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function AppNavigator() {
  const { loading, user, supabase } = useAuth();
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    if (!user) {
      setUsernameChecked(true);
      return;
    }
    (async () => {
      const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
      setNeedsUsername(!data?.username);
      setUsernameChecked(true);
    })().catch(() => setUsernameChecked(true));
  }, [user]);

  if (loading || !usernameChecked) {
    return <SplashScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        initialRouteName={needsUsername ? 'UsernameSetup' : 'MainTabs'}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
      >
        {/* Auth screens */}
        <Stack.Screen name="Landing" component={LandingScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'slide_from_right' }} />

        {/* Username setup (blocking step before tabs) */}
        <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} options={{ animation: 'fade' }} />

        {/* Main tabs */}
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />

        {/* Push screens */}
        <Stack.Screen name="Processing" component={ProcessingScreen} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'slide_from_bottom', presentation: 'card', ...sharedHeader, headerShown: true, title: 'Your Results' }} />
        <Stack.Screen name="ActionPlan" component={ActionPlanScreen} options={{ ...sharedHeader, headerShown: true, title: '90-Day Plan', animation: 'slide_from_right' }} />
        <Stack.Screen name="DebtPayoff" component={DebtPayoffScreen} options={{ ...sharedHeader, headerShown: true, title: 'Debt Payoff', animation: 'slide_from_right' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...sharedHeader, headerShown: true, title: 'Settings', animation: 'slide_from_right' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ ...sharedHeader, headerShown: true, title: 'Privacy Policy', animation: 'slide_from_right' }} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ ...sharedHeader, headerShown: true, title: 'Terms of Service', animation: 'slide_from_right' }} />
        <Stack.Screen name="HelpFAQ" component={HelpFAQScreen} options={{ ...sharedHeader, headerShown: true, title: 'Help & FAQ', animation: 'slide_from_right' }} />
        <Stack.Screen name="ScenarioSimulator" component={ScenarioSimulatorScreen} options={{ ...sharedHeader, headerShown: true, title: 'Scenarios', animation: 'slide_from_right' }} />
        <Stack.Screen name="SubscriptionAudit" component={SubscriptionAuditScreen} options={{ ...sharedHeader, headerShown: true, title: 'Subscriptions', animation: 'slide_from_right' }} />
        <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} options={{ ...sharedHeader, headerShown: true, title: 'Creator Dashboard', animation: 'slide_from_right' }} />

        {/* Modal sheets */}
        <Stack.Screen name="Share" component={ShareScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', ...sharedHeader, headerShown: true, title: 'Share Result' }} />
        <Stack.Screen name="Paywall" component={PaywallScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="MonthlyCheckIn" component={MonthlyCheckInScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal', ...sharedHeader, headerShown: true, title: 'Monthly Check-In' }} />
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
