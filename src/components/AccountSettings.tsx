import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Linking, ActivityIndicator, ActionSheetIOS } from 'react-native';
import { PressableScale } from '@/components/motion';
import Constants from 'expo-constants';
import Toggle from '@/components/Toggle';
import TierPill from '@/components/TierPill';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, RoastTone } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { BRAND } from '@/config/brand';
import { FEATURES } from '@/config/features';
import * as Notifications from 'expo-notifications';
import {
  ClipboardDocumentListIcon, SparklesIcon, CreditCardIcon, ArrowTrendingUpIcon,
  ArrowTopRightOnSquareIcon, BellIcon, CalendarIcon, FingerPrintIcon, ChatBubbleBottomCenterTextIcon, BoltIcon,
  QuestionMarkCircleIcon, ShieldCheckIcon, DocumentTextIcon, StarIcon, ArchiveBoxXMarkIcon, TrashIcon,
} from 'react-native-heroicons/outline';
import { useAuth } from '@/context/AuthContext';
import { useLegal } from '@/context/LegalContext';
import { useSubscription } from '@/hooks/useSubscription';
import { manageSubscriptions } from '@/services/purchases';
import { deleteUserData } from '@/services/gdpr';
import { setHapticsEnabled, getHapticsEnabled } from '@/utils/haptics';
import { isBiometricAvailable, isLockEnabled, setLockEnabled, authenticate } from '@/services/biometric';
import { getCheckinConfig, getCheckIns } from '@/services/checkins';
import { getProfile, updateProfile } from '@/services/profile';
import { deleteAllAnalyses } from '@/services/analyses';
import { nextReminderDate } from '@/utils/checkinSchedule';
import {
  requestNotificationPermission, scheduleCheckinReminder, cancelCheckinReminders,
  getCheckinReminderEnabled, setCheckinReminderEnabledFlag,
} from '@/services/notifications';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

type SettingRow =
  | { type: 'toggle'; label: string; key: string; icon: IconComponent; detail?: string }
  | { type: 'action'; label: string; icon: IconComponent; detail?: string; destructive?: boolean; loadingKey?: string; onPress: () => void }
  | { type: 'nav'; label: string; icon: IconComponent; detail?: string; right?: 'tier' | 'external'; onPress: () => void };

// The user's roast voice (profiles.preferred_tone). Labels mirror the RoastComposer tone selector.
const TONE_OPTIONS: { key: RoastTone; label: string }[] = [
  { key: 'savage', label: 'Savage' },
  { key: 'gentle', label: 'Gentle' },
  { key: 'therapist', label: 'Therapist' },
  { key: 'older_sibling', label: 'Big Sibling' },
  { key: 'finance_bro', label: 'Finance Bro' },
];

/**
 * The full account/settings list, rendered inline on the Profile tab (Cash App-style single
 * account hub — there is no separate Settings screen). Owns its own toggle/biometric/notification/
 * GDPR state so the Profile view layer stays thin.
 */
export default function AccountSettings({ navigation }: Props) {
  const { signOut, user } = useAuth();
  const { showLegal } = useLegal();
  const { tier: purchaseTier, premium } = useSubscription();
  const nav = navigation.navigate as (route: string, params?: object) => void;
  const [toggles, setToggles] = useState({
    notifications: false,
    monthlyReminder: false,
    haptics: true,
    faceID: false,
  });
  const [gdprLoading, setGdprLoading] = useState<string | null>(null);
  const [tone, setTone] = useState<RoastTone>('savage');

  // Reflect persisted / OS state on mount.
  useEffect(() => {
    getCheckinReminderEnabled().then((on) => setToggles((p) => ({ ...p, monthlyReminder: on })));
    isLockEnabled().then((on) => setToggles((p) => ({ ...p, faceID: on })));
    Notifications.getPermissionsAsync().then((s) => setToggles((p) => ({ ...p, notifications: s.granted }))).catch(() => {});
    setToggles((p) => ({ ...p, haptics: getHapticsEnabled() }));
    if (user) getProfile(user.id).then((p) => { if (p?.preferred_tone) setTone(p.preferred_tone); }).catch(() => {});
  }, [user]);

  // Roast voice — the sticky tone preference, also settable from the RoastComposer selector.
  const onChangeTone = () => {
    const labels = TONE_OPTIONS.map((t) => t.label);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Your roast voice', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
      (i) => {
        if (i < 0 || i >= labels.length) return;
        const key = TONE_OPTIONS[i].key;
        setTone(key);
        if (user) updateProfile(user.id, { preferred_tone: key }).catch(() => {});
      },
    );
  };

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

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber;
  const versionLabel = `Version ${appVersion}${buildNumber ? ` (${buildNumber})` : ''}`;

  // Account — plan management lives here now (Profile is the single account hub). "Plans & Features"
  // is in-app and visible to everyone; "Manage Subscription" only when subscribed → the App Store.
  const accountRows: SettingRow[] = [
    { type: 'nav', label: 'Financial Context', icon: ClipboardDocumentListIcon, onPress: () => nav('FinancialContext') },
    { type: 'nav', label: 'Plans & Features', icon: SparklesIcon, right: 'tier', onPress: () => nav('Paywall') },
    ...(premium ? [{ type: 'nav', label: 'Manage Subscription', icon: CreditCardIcon, right: 'external', onPress: () => manageSubscriptions() } as SettingRow] : []),
    ...(FEATURES.CREATOR_DASHBOARD ? [{ type: 'nav', label: 'Creator Dashboard', icon: ArrowTrendingUpIcon, onPress: () => nav('CreatorDashboard') } as SettingRow] : []),
  ];

  const SECTIONS: { title: string; rows: SettingRow[] }[] = [
    {
      title: 'Account',
      rows: accountRows,
    },
    {
      title: 'Notifications',
      rows: [
        { type: 'toggle', label: 'Push Notifications', key: 'notifications', icon: BellIcon },
        { type: 'toggle', label: 'Monthly Check-In Reminder', key: 'monthlyReminder', icon: CalendarIcon, detail: 'On your check-in date each month' },
      ],
    },
    {
      title: 'Security',
      rows: [
        { type: 'toggle', label: 'Face ID / Touch ID', key: 'faceID', icon: FingerPrintIcon, detail: 'Require unlock to open the app' },
      ],
    },
    {
      title: 'App',
      rows: [
        { type: 'nav', label: 'Roast Voice', icon: ChatBubbleBottomCenterTextIcon, detail: TONE_OPTIONS.find((t) => t.key === tone)?.label, onPress: onChangeTone },
        { type: 'toggle', label: 'Haptic Feedback', key: 'haptics', icon: BoltIcon },
      ],
    },
    {
      title: 'Support',
      rows: [
        { type: 'nav', label: 'Help & FAQ', icon: QuestionMarkCircleIcon, onPress: () => nav('HelpFAQ') },
        { type: 'nav', label: 'Privacy Policy', icon: ShieldCheckIcon, onPress: () => showLegal('privacy') },
        { type: 'nav', label: 'Terms of Service', icon: DocumentTextIcon, onPress: () => showLegal('terms') },
        { type: 'nav', label: 'Rate Am I Broke?', icon: StarIcon, onPress: () => Linking.openURL(BRAND.appStoreUrl) },
      ],
    },
    {
      title: 'Danger Zone',
      rows: [
        { type: 'action', label: 'Clear Roast History', icon: ArchiveBoxXMarkIcon, destructive: true, loadingKey: 'clear', onPress: () => {
          if (!user) return;
          Alert.alert('Clear History?', 'This permanently deletes all your roasts. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: async () => {
              setGdprLoading('clear');
              const ok = await deleteAllAnalyses(user.id);
              setGdprLoading(null);
              Alert.alert(ok ? 'History Cleared' : 'Failed', ok ? 'All your roasts have been deleted.' : 'Could not clear your history.');
            } },
          ]);
        } },
        { type: 'action', label: 'Delete Account', icon: TrashIcon, destructive: true, loadingKey: 'delete', onPress: handleDeleteAccount },
      ],
    },
  ];

  return (
    <View>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.group}>
            {section.rows.map((row, i) => {
              const Icon = row.icon;
              const isDestructive = row.type === 'action' && row.destructive;
              const content = (
                <>
                  {i > 0 && <View style={styles.sep} />}
                  <View style={styles.cell}>
                    <View style={styles.cellLeft}>
                      <Icon size={22} color={isDestructive ? Colors.danger : Colors.textPrimary} />
                      <View>
                        <Text style={[styles.cellLabel, isDestructive && styles.cellLabelDanger]}>{row.label}</Text>
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
                      {row.type === 'action' && gdprLoading === row.loadingKey && (
                        <ActivityIndicator size="small" color={row.destructive ? Colors.danger : Colors.textMuted} />
                      )}
                      {row.type === 'action' && gdprLoading !== row.loadingKey && (
                        <Text style={styles.chevron}>›</Text>
                      )}
                      {row.type === 'nav' && row.right === 'tier' && (
                        <>
                          <TierPill tier={purchaseTier} size="md" />
                          <Text style={styles.chevron}>›</Text>
                        </>
                      )}
                      {row.type === 'nav' && row.right === 'external' && (
                        <ArrowTopRightOnSquareIcon size={18} color={Colors.textSecondary} />
                      )}
                      {row.type === 'nav' && !row.right && (
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
                <PressableScale key={row.label} onPress={row.onPress}>
                  {content}
                </PressableScale>
              );
            })}
          </View>
        </View>
      ))}
      {user && (
        <PressableScale style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </PressableScale>
      )}
      <Text style={styles.versionFooter}>{versionLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  cellLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  cellLabelDanger: { color: Colors.danger },
  cellDetail: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 1 },
  cellRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginLeft: Spacing.sm },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '300' },
  signOutBtn: {
    alignItems: 'center', paddingVertical: Spacing.md,
    borderRadius: Radius.lg, marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,69,58,0.35)',
    backgroundColor: Colors.dangerContainer,
  },
  signOutText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.danger },
});
