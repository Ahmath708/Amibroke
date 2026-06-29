import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, useReducedMotion,
  FadeIn, FadeOut, FadeInDown, FadeOutDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  HomeIcon as HomeOutline,
  BanknotesIcon as FinOutline,
  UserGroupIcon as CommunityOutline,
  UserIcon as ProfileOutline,
} from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeSolid,
  BanknotesIcon as FinSolid,
  UserGroupIcon as CommunitySolid,
  UserIcon as ProfileSolid,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
} from 'react-native-heroicons/solid';
import PlusGlyph from '@/components/PlusGlyph';
import RoastIcon from '@/components/RoastIcon';
import HeaderBackButton from '@/components/HeaderBackButton';
import SheetGrabber from '@/components/SheetGrabber';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, MainTabsParamList } from '@/types';
import { Colors, Typography, Radius } from '@/theme/colors';
import { Springs } from '@/theme/motion';
import { useAuth } from '@/context/AuthContext';


// Screens
import SplashScreen from '@/screens/SplashScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import LandingScreen from '@/screens/LandingScreen';
import LoginScreen from '@/screens/LoginScreen';
import RoastComposerScreen from '@/screens/RoastComposerScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import FinancialsScreen from '@/screens/FinancialsScreen';
import SpendingEditorScreen from '@/screens/SpendingEditorScreen';
import DebtManagerScreen from '@/screens/DebtManagerScreen';
import ProcessingScreen from '@/screens/ProcessingScreen';
import ResultsScreen from '@/screens/ResultsScreen';
import ActionPlanScreen from '@/screens/ActionPlanScreen';
import DebtPayoffScreen from '@/screens/DebtPayoffScreen';
import ShareScreen from '@/screens/ShareScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import TrendScreen from '@/screens/TrendScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import CommunityFeedScreen from '@/screens/CommunityFeedScreen';
import EditProfileScreen from '@/screens/EditProfileScreen';
import RoastVoiceScreen from '@/screens/RoastVoiceScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import HelpFAQScreen from '@/screens/HelpFAQScreen';
import ScenarioSimulatorScreen from '@/screens/ScenarioSimulatorScreen';
import SubscriptionAuditScreen from '@/screens/SubscriptionAuditScreen';
import FinancialContextScreen from '@/screens/FinancialContextScreen';
import MonthlyCheckInScreen from '@/screens/MonthlyCheckInScreen';
import { CHECK_IN_NAME } from '@/config/tools';
import CreatorDashboardScreen from '@/screens/CreatorDashboardScreen';

import { TAB_ROW_HEIGHT, TAB_FLOAT_MARGIN } from '@/navigation/constants';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

// UI/navigation chrome → Heroicons (active = solid, inactive = outline).
const TAB_ICONS: Record<string, { active: React.ComponentType<any>; inactive: React.ComponentType<any> }> = {
  Home:      { active: HomeSolid,      inactive: HomeOutline },
  Financials:{ active: FinSolid,       inactive: FinOutline },
  Community: { active: CommunitySolid, inactive: CommunityOutline },
  Profile:   { active: ProfileSolid,   inactive: ProfileOutline },
};

// Center-FAB action menu (Claude Design): the raised ⊕ opens three cards that push the
// core-loop entry points. Roast Me is the primary (accent-washed) action.
const FAB_ACTIONS: { key: string; label: string; route: keyof RootStackParamList; Icon: React.ComponentType<any>; primary?: boolean }[] = [
  { key: 'checkin', label: 'Check-In',    route: 'MonthlyCheckIn', Icon: CalendarDaysIcon },
  { key: 'roast',   label: 'Roast Me',    route: 'Analyze',       Icon: RoastIcon, primary: true },
  { key: 'plan',    label: 'Update Plan', route: 'ActionPlan',     Icon: ClipboardDocumentListIcon },
];

// A single icon-only tab. Active = the solid glyph in the accent inside a pink "ghost pill";
// inactive = the outline glyph at white@36% (the Claude Design navpill).
function TabBarButton({ name, focused, reduce, disabled, onPress }: { name: string; focused: boolean; reduce: boolean; disabled?: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = reduce ? 1 : withSpring(focused ? 1.08 : 1, Springs.gentle);
  }, [focused, reduce]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const icons = TAB_ICONS[name];
  const TabIcon = focused ? icons.active : icons.inactive;
  return (
    <TouchableOpacity
      style={tabStyles.tabItem}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected: focused, disabled: !!disabled }}
    >
      <Animated.View style={[iconStyle, focused && tabStyles.ghostPill]}>
        <TabIcon size={24} color={focused ? Colors.accentSolid : tabStyles.inactiveColor.color} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function IOSTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const navOffset = Math.min(insets.bottom, 12) + TAB_FLOAT_MARGIN;

  // FAB rotates the ⊕ to an ✕ while the action menu is open.
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = reduce ? (menuOpen ? 1 : 0) : withTiming(menuOpen ? 1 : 0, { duration: 280 });
  }, [menuOpen, reduce]);
  const fabIconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(rot.value, [0, 1], [0, 45])}deg` }] }));

  const closeMenu = () => setMenuOpen(false);
  const runAction = (route: keyof RootStackParamList) => {
    setMenuOpen(false);
    Haptics.selectionAsync();
    (navigation.navigate as any)(route);
  };
  const goTab = (routeName: string, routeKey: string, index: number) => {
    if (menuOpen) setMenuOpen(false);
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) {
      Haptics.selectionAsync();
      navigation.navigate(routeName);
    }
  };

  // routes order = Home, Financials, Community, Profile; the FAB is injected between 1 and 2.
  const tab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    return (
      <TabBarButton
        key={route.key}
        name={route.name}
        focused={state.index === index}
        reduce={reduce}
        disabled={menuOpen}
        onPress={() => goTab(route.name, route.key, index)}
      />
    );
  };

  return (
    <View pointerEvents="box-none" style={tabStyles.host}>
      {/* full-screen blur scrim — taps dismiss the menu */}
      {menuOpen && (
        <AnimatedPressable
          entering={reduce ? undefined : FadeIn.duration(220)}
          exiting={reduce ? undefined : FadeOut.duration(200)}
          style={tabStyles.scrim}
          onPress={closeMenu}
        >
          <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
        </AnimatedPressable>
      )}

      {/* action menu — three cards above the navpill */}
      {menuOpen && (
        <View pointerEvents="box-none" style={[tabStyles.actionMenu, { bottom: navOffset + TAB_ROW_HEIGHT + 16 }]}>
          {FAB_ACTIONS.map((a, i) => (
            <Animated.View
              key={a.key}
              entering={reduce ? undefined : FadeInDown.delay(i * 45).duration(300)}
              exiting={reduce ? undefined : FadeOutDown.duration(160)}
              style={tabStyles.actCardWrap}
            >
              <TouchableOpacity
                style={[tabStyles.actCard, a.primary && tabStyles.actCardPrimary]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={() => runAction(a.route)}
              >
                <a.Icon size={28} color={a.primary ? Colors.accentSolid : Colors.textPrimary} />
                <Text style={tabStyles.actLabel}>{a.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      )}

      {/* floating navpill */}
      <View style={[tabStyles.outerWrapper, { paddingBottom: navOffset }]}>
        <View style={tabStyles.capsuleShadow}>
          <BlurView intensity={40} tint="dark" style={tabStyles.capsule}>
            <View style={tabStyles.tabRow}>
              {tab(0)}
              {tab(1)}
              <View style={tabStyles.navCenter}>
                <Pressable
                  style={tabStyles.fab}
                  onPress={() => setMenuOpen((o) => !o)}
                  accessibilityRole="button"
                  accessibilityLabel={menuOpen ? 'Close actions' : 'Open actions'}
                >
                  <Animated.View style={fabIconStyle}>
                    <PlusGlyph size={26} color={Colors.onAccent} strokeWidth={2.8} />
                  </Animated.View>
                </Pressable>
              </View>
              {tab(2)}
              {tab(3)}
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <IOSTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Financials" component={FinancialsScreen} />
      <Tab.Screen name="Community" component={CommunityFeedScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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

// Header title for the swipe-down compose modals (Roast Me / Check-In / Update Plan): a grabber pill
// stacked above the title so the swipe-down-to-close affordance is obvious.
//
// WHY headerTitle (not headerBackground): native-stack silently fails to paint a custom
// `headerBackground` here (the pill never shows, at any paddingTop). The only header slots it
// reliably renders are the ones that hold real content — headerLeft/headerRight/headerTitle. So we
// borrow BottomSheet's trick (the grabber is just a <View> we control) and put it in headerTitle.
function ModalHeaderTitle({ title }: { title?: string }) {
  return (
    <View style={modalHeaderStyles.titleWrap}>
      <SheetGrabber style={modalHeaderStyles.grabber} />
      {title ? <Text style={modalHeaderStyles.title} numberOfLines={1}>{title}</Text> : null}
    </View>
  );
}

const modalHeaderStyles = StyleSheet.create({
  titleWrap: { alignItems: 'center', justifyContent: 'center' },
  grabber: { marginBottom: 6 },
  title: { fontFamily: Typography.fonts.headingSemi, fontSize: 17, color: Colors.textPrimary },
});

const modalHeader = {
  ...sharedHeader,
  headerTitleAlign: 'center',
  headerTitle: ({ children }: { children: string }) => <ModalHeaderTitle title={children} />,
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
        ) : needsOnboarding ? (
          /* ─── First-run gate: personalization ─── */
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        ) : (
          /* ─── Signed in: APP STACK ─── */
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
            <Stack.Screen name="Analyze" component={RoastComposerScreen} options={{ ...modalHeader, headerShown: true, title: 'New Roast', presentation: 'modal', gestureEnabled: true }} />
            <Stack.Screen name="History" component={TrendScreen} options={{ ...sharedHeader, headerShown: true, title: 'History', animation: 'slide_from_right' }} />
            <Stack.Screen name="Processing" component={ProcessingScreen} options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="Results" component={ResultsScreen} options={{ animation: 'slide_from_bottom', presentation: 'card', ...sharedHeader, headerShown: true, title: 'Your Results' }} />
            <Stack.Screen name="ActionPlan" component={ActionPlanScreen} options={{ ...modalHeader, headerShown: true, title: '90-Day Plan', presentation: 'modal', gestureEnabled: true }} />
            <Stack.Screen name="DebtPayoff" component={DebtPayoffScreen} options={{ ...sharedHeader, headerShown: true, title: 'Debt Payoff', animation: 'slide_from_right' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ ...sharedHeader, headerShown: true, title: 'Notifications', animation: 'slide_from_right' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ ...sharedHeader, headerShown: true, title: 'Edit Profile', animation: 'slide_from_right' }} />
            {/* Renders its own BottomSheet — present transparently (no native card/header) so the sheet animates over Profile. */}
            <Stack.Screen name="RoastVoice" component={RoastVoiceScreen} options={{ headerShown: false, presentation: 'transparentModal', animation: 'none', gestureEnabled: false }} />
            <Stack.Screen name="FinancialContext" component={FinancialContextScreen} options={{ ...sharedHeader, headerShown: true, title: 'Life Context', animation: 'slide_from_right' }} />
            <Stack.Screen name="HelpFAQ" component={HelpFAQScreen} options={{ ...sharedHeader, headerShown: true, title: 'Help & FAQ', animation: 'slide_from_right' }} />
            <Stack.Screen name="ScenarioSimulator" component={ScenarioSimulatorScreen} options={{ ...sharedHeader, headerShown: true, title: 'Scenarios', animation: 'slide_from_right' }} />
            {/* Financial screens use the CUSTOM back button (no native long-press history menu).
                Roll out to the rest once approved. */}
            <Stack.Screen name="SubscriptionAudit" component={SubscriptionAuditScreen} options={{ ...sharedHeader, headerShown: true, title: 'Subscriptions', animation: 'slide_from_right', headerLeft: () => <HeaderBackButton /> }} />
            <Stack.Screen name="SpendingEditor" component={SpendingEditorScreen} options={{ ...sharedHeader, headerShown: true, title: 'Spending', animation: 'slide_from_right', headerLeft: () => <HeaderBackButton /> }} />
            <Stack.Screen name="DebtManager" component={DebtManagerScreen} options={{ ...sharedHeader, headerShown: true, title: 'Debts', animation: 'slide_from_right', headerLeft: () => <HeaderBackButton /> }} />
            <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} options={{ ...sharedHeader, headerShown: true, title: 'Creator Dashboard', animation: 'slide_from_right' }} />
            {/* Card (slide-up), NOT a formSheet: ShareScreen is long + scrollable, and a formSheet
                only defers scroll to a ScrollView that's the screen's FIRST child — ours is
                ScreenBackground, so the sheet gesture ate the scroll (RNScreens #2687/#3092). */}
            <Stack.Screen name="Share" component={ShareScreen} options={{ ...sharedHeader, headerShown: true, title: 'Share Result', animation: 'slide_from_bottom', presentation: 'card' }} />
            {/* Same swipe-down modal as the compose modals — grabber in the header (modalHeader →
                headerTitle), no title. Plain `modal` (not formSheet) so the inner ScrollView scrolls;
                formSheet's gesture eats the scroll when ScreenBackground is the screen's first child
                (RNScreens #2687/#3092). Dismiss via swipe/grabber (no X button). */}
            <Stack.Screen name="Paywall" component={PaywallScreen} options={{ ...modalHeader, headerShown: true, title: '', presentation: 'modal', gestureEnabled: true }} />
            <Stack.Screen name="MonthlyCheckIn" component={MonthlyCheckInScreen} options={{ ...modalHeader, headerShown: true, title: CHECK_IN_NAME, presentation: 'modal', gestureEnabled: true }} />
          </>
        )}
      </Stack.Navigator>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  // Full-screen, touch-transparent host so the menu scrim can cover the screen above
  // the bar while the navpill stays anchored to the bottom.
  host: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Scrim extends UP from the screen bottom (the host has no measured height, so a
  // fixed tall box reliably covers any phone above the bar).
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1400 },

  // Floating navpill: detached from the screen edges, lifted off the safe area.
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  capsuleShadow: {
    borderRadius: TAB_ROW_HEIGHT / 2,
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  capsule: {
    height: TAB_ROW_HEIGHT,
    borderRadius: TAB_ROW_HEIGHT / 2,
    overflow: 'hidden',
    paddingHorizontal: 12, // breathing room at the rounded ends
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(22,22,31,0.66)',
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
  // Active "ghost pill" behind the focused icon (accent wash).
  ghostPill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentContainer,
  },
  inactiveColor: { color: 'rgba(255,255,255,0.36)' },

  // Center FAB
  navCenter: { width: 60, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentSolid,
    shadowColor: Colors.accentSolid,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },

  // Action menu (three cards above the navpill)
  actionMenu: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 11,
  },
  actCardWrap: { flex: 1 },
  actCard: {
    minHeight: 116,
    borderRadius: Radius.xxl,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
  },
  actCardPrimary: {
    borderColor: Colors.accentBorder,
    backgroundColor: 'rgba(255, 0, 122, 0.3)', // less see-through than accentContainer (0.12)
  },
  actLabel: {
    fontFamily: Typography.fonts.bodySemi,
    fontSize: 13,
    letterSpacing: -0.2,
    color: Colors.textPrimary,
  },
});
