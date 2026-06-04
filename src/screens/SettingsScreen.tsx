import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Linking, ActivityIndicator, Animated,
} from 'react-native';
import Constants from 'expo-constants';
import Toggle from '@/components/Toggle';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { FEATURES } from '@/config/features';
import ScreenBackground from '@/components/ScreenBackground';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, setPendingRedirect } from '@/context/AuthContext';
import { useLegal } from '@/context/LegalContext';
import { deleteUserData } from '@/services/gdpr';
import { setHapticsEnabled, getHapticsEnabled } from '@/utils/haptics';
import { isBiometricAvailable, isLockEnabled, setLockEnabled, authenticate } from '@/services/biometric';
import { useSubscription } from '@/hooks/useSubscription';
import { manageSubscriptions } from '@/services/purchases';
import { PURCHASE_PRODUCTS } from '@/types';
import { getCheckinConfig, getCheckIns, deleteAllAnalyses } from '@/services/claudeApi';
import { nextReminderDate } from '@/utils/checkinSchedule';
import {
  requestNotificationPermission, scheduleCheckinReminder, cancelCheckinReminders,
  getCheckinReminderEnabled, setCheckinReminderEnabledFlag,
} from '@/services/notifications';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'> };

type SettingRow =
  | { type: 'toggle'; label: string; key: string; icon: string; detail?: string }
  | { type: 'action'; label: string; icon: string; detail?: string; destructive?: boolean; onPress: () => void }
  | { type: 'nav'; label: string; icon: string; detail?: string; onPress: () => void };

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();
  const { tier, premium } = useSubscription();
  const { showLegal } = useLegal();
  const [toggles, setToggles] = useState({
    notifications: false,
    monthlyReminder: false,
    haptics: true,
    faceID: false,
  });
  const [gdprLoading, setGdprLoading] = useState<string | null>(null);
  const { animatedStyle } = useEntryAnimation();

  // Reflect persisted / OS state on mount.
  useEffect(() => {
    getCheckinReminderEnabled().then((on) => setToggles((p) => ({ ...p, monthlyReminder: on })));
    isLockEnabled().then((on) => setToggles((p) => ({ ...p, faceID: on })));
    Notifications.getPermissionsAsync().then((s) => setToggles((p) => ({ ...p, notifications: s.granted }))).catch(() => {});
    setToggles((p) => ({ ...p, haptics: getHapticsEnabled() }));
  }, []);

  // Push Notifications: iOS can't revoke permission in-app, so reflect the real
  // permission and route to iOS Settings to change it.
  const onTogglePush = async (next: boolean) => {
    if (next) {
      const granted = await requestNotificationPermission();
      setToggles((p) => ({ ...p, notifications: granted }));
      if (!granted) {
        Alert.alert('Enable in Settings', 'Turn on notifications for Am I Broke? in iOS Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      }
    } else {
      Alert.alert('Manage in Settings', 'Turn notifications off for Am I Broke? in iOS Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      const s = await Notifications.getPermissionsAsync();
      setToggles((p) => ({ ...p, notifications: s.granted })); // stays reflecting reality
    }
  };

  const onToggleHaptics = (next: boolean) => {
    setToggles((p) => ({ ...p, haptics: next }));
    setHapticsEnabled(next);
  };

  // Face ID / Touch ID app lock. Enabling requires hardware + a confirming auth.
  const onToggleFaceID = async (next: boolean) => {
    if (next) {
      if (!(await isBiometricAvailable())) {
        Alert.alert('Biometrics unavailable', 'Set up Face ID or Touch ID on your device first, then try again.');
        return; // leave the toggle off
      }
      if (!(await authenticate('Enable app lock'))) return; // auth failed/cancelled
      await setLockEnabled(true);
      setToggles((p) => ({ ...p, faceID: true }));
    } else {
      await setLockEnabled(false);
      setToggles((p) => ({ ...p, faceID: false }));
    }
  };

  // Monthly check-in reminder: request permission, schedule at the next anchor, persist.
  const onToggleReminder = async (next: boolean) => {
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Notifications are off', 'Enable notifications for Am I Broke? in iOS Settings to get check-in reminders.');
        return; // leave the toggle off
      }
      setToggles((p) => ({ ...p, monthlyReminder: true }));
      await setCheckinReminderEnabledFlag(true);
      if (user) {
        const [cfg, checkins] = await Promise.all([getCheckinConfig(user.id), getCheckIns(user.id)]);
        const date = nextReminderDate(
          cfg.firstAnalyzeAt ? new Date(cfg.firstAnalyzeAt) : null,
          checkins[0] ? new Date(checkins[0].created_at) : null,
          new Date(),
        );
        await scheduleCheckinReminder(date);
      }
    } else {
      setToggles((p) => ({ ...p, monthlyReminder: false }));
      await setCheckinReminderEnabledFlag(false);
      await cancelCheckinReminders();
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    Alert.alert(
      'Delete Account?',
      'All your data will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setGdprLoading('delete');
            const result = await deleteUserData(user.id);
            setGdprLoading(null);
            if (result.success) {
              Alert.alert('Account Deleted', 'Your data has been permanently removed.', [
                { text: 'OK', onPress: () => { signOut(); navigation.reset({ index: 0, routes: [{ name: 'Landing' }] }); } },
              ]);
            } else {
              Alert.alert('Delete Failed', result.error || 'Could not delete your account.');
            }
          },
        },
      ],
    );
  };

  // No "Profile" row here — Settings is reached *through* Profile, so linking back
  // would be circular.
  const accountRows: SettingRow[] = [
    { type: 'nav', label: 'Subscription', icon: 'card-outline', detail: premium ? PURCHASE_PRODUCTS[tier]?.label ?? 'Premium' : 'Free Plan', onPress: () => {
      if (!user) {
        setPendingRedirect('Paywall');
        navigation.navigate('Login');
      } else if (premium) {
        manageSubscriptions();
      } else {
        navigation.navigate('Paywall');
      }
    }},
    ...(FEATURES.CREATOR_DASHBOARD ? [{ type: 'nav' as const, label: 'Creator Dashboard', icon: 'trending-up-outline', onPress: () => navigation.navigate('CreatorDashboard') }] : []),
  ];

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber;
  const versionLabel = `Version ${appVersion}${buildNumber ? ` (${buildNumber})` : ''}`;

  const SECTIONS: { title: string; rows: SettingRow[] }[] = [
    {
      title: 'Account',
      rows: accountRows,
    },
    {
      title: 'Notifications',
      rows: [
        { type: 'toggle', label: 'Push Notifications', key: 'notifications', icon: 'notifications-outline' },
        { type: 'toggle', label: 'Monthly Check-In Reminder', key: 'monthlyReminder', icon: 'calendar-outline', detail: 'On your check-in date each month' },
      ],
    },
    {
      title: 'Security',
      rows: [
        { type: 'toggle', label: 'Face ID / Touch ID', key: 'faceID', icon: 'finger-print-outline', detail: 'Require unlock to open the app' },
      ],
    },
    {
      title: 'App',
      rows: [
        { type: 'toggle', label: 'Haptic Feedback', key: 'haptics', icon: 'pulse-outline' },
        { type: 'nav', label: 'Monthly Check-In', icon: 'clipboard-outline', onPress: () => navigation.navigate('MonthlyCheckIn') },
        { type: 'nav', label: 'Subscription Audit', icon: 'search-outline', onPress: () => navigation.navigate('SubscriptionAudit') },
      ],
    },
    {
      title: 'Support',
      rows: [
        { type: 'nav', label: 'Help & FAQ', icon: 'help-circle-outline', onPress: () => navigation.navigate('HelpFAQ') },
        { type: 'nav', label: 'Privacy Policy', icon: 'shield-checkmark-outline', onPress: () => showLegal('privacy') },
        { type: 'nav', label: 'Terms of Service', icon: 'document-text-outline', onPress: () => showLegal('terms') },
        { type: 'nav', label: 'Rate Am I Broke?', icon: 'star-outline', onPress: () => Linking.openURL('https://apps.apple.com/app/am-i-broke/id123456789') },
      ],
    },
    {
      title: 'Danger Zone',
      rows: [
        { type: 'action', label: 'Sign Out', icon: 'log-out-outline', destructive: true, onPress: () => signOut() },
        { type: 'action', label: 'Clear Analysis History', icon: 'trash-outline', destructive: true, onPress: () => {
          if (!user) return;
          Alert.alert('Clear History?', 'This permanently deletes all your analyses. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: async () => {
              const ok = await deleteAllAnalyses(user.id);
              Alert.alert(ok ? 'History Cleared' : 'Failed', ok ? 'All your analyses have been deleted.' : 'Could not clear your history.');
            } },
          ]);
        } },
        { type: 'action', label: 'Delete Account', icon: 'close-circle-outline', destructive: true, onPress: handleDeleteAccount },
      ],
    },
  ];

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="settings" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.group}>
              {section.rows.map((row, i) => {
                const content = (
                  <>
                    {i > 0 && <View style={styles.sep} />}
                    <View style={styles.cell}>
                      <View style={styles.cellLeft}>
                        <View style={[styles.iconBadge, row.type === 'action' && row.destructive && styles.iconBadgeDanger]}>
                          <Ionicons
                            name={row.icon as any}
                            size={18}
                            color={row.type === 'action' && row.destructive ? Colors.danger : Colors.primary}
                          />
                        </View>
                        <View>
                          <Text style={[
                            styles.cellLabel,
                            row.type === 'action' && row.destructive && styles.cellLabelDanger,
                          ]}>{row.label}</Text>
                          {row.detail && <Text style={styles.cellDetail}>{row.detail}</Text>}
                        </View>
                      </View>
                      <View style={styles.cellRight}>
                        {row.type === 'toggle' && (
                          <Toggle
                            value={toggles[row.key as keyof typeof toggles]}
                            onValueChange={(v) => {
                              if (row.key === 'monthlyReminder') onToggleReminder(v);
                              else if (row.key === 'notifications') onTogglePush(v);
                              else if (row.key === 'haptics') onToggleHaptics(v);
                              else if (row.key === 'faceID') onToggleFaceID(v);
                            }}
                          />
                        )}
                        {row.type === 'action' && gdprLoading === row.label.toLowerCase().split(' ')[0] && (
                          <ActivityIndicator size="small" color={row.destructive ? Colors.danger : Colors.textMuted} />
                        )}
                        {(row.type === 'nav' || (row.type === 'action' && gdprLoading !== row.label.toLowerCase().split(' ')[0])) && (
                          <Text style={styles.chevron}>›</Text>
                        )}
                      </View>
                    </View>
                  </>
                );

                if (row.type === 'toggle') {
                  return <React.Fragment key={row.label}>{content}</React.Fragment>;
                }

                return (
                  <TouchableOpacity key={row.label} activeOpacity={0.7} onPress={row.onPress}>
                    {content}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        <Text style={styles.versionFooter}>{versionLabel}</Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  versionFooter: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.caption1.fontSize,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  section: { marginBottom: Spacing.xxl },
  sectionTitle: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.sm, paddingLeft: Spacing.xs,
  },
  group: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.rowHeightLg },
  cell: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingRight: Spacing.lg, paddingVertical: Spacing.sm, paddingLeft: Spacing.md,
    minHeight: 50,
  },
  cellLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  iconBadge: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeDanger: { backgroundColor: Colors.dangerContainer },
  cellIcon: { fontSize: Typography.callout.fontSize },
  cellLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  cellLabelDanger: { color: Colors.danger },
  cellDetail: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 1 },
  cellRight: { marginLeft: Spacing.sm },
  chevronBtn: { padding: 4 },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '300' },
});
