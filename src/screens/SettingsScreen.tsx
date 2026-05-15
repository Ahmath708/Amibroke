import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'> };

type SettingRow =
  | { type: 'toggle'; label: string; key: string; icon: string; detail?: string }
  | { type: 'action'; label: string; icon: string; detail?: string; destructive?: boolean; onPress: () => void }
  | { type: 'nav'; label: string; icon: string; detail?: string; onPress: () => void };

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [toggles, setToggles] = useState({
    notifications: true,
    weeklyReminder: false,
    communityVisible: true,
    haptics: true,
    faceID: false,
  });

  const toggle = (key: string) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));

  const SECTIONS: { title: string; rows: SettingRow[] }[] = [
    {
      title: 'Account',
      rows: [
        { type: 'nav', label: 'Profile', icon: '👤', detail: '@yourusername', onPress: () => (navigation.navigate as any)('Home', { screen: 'Profile' }) },
        { type: 'nav', label: 'Subscription', icon: '⭐', detail: 'Free Plan', onPress: () => navigation.navigate('Paywall') },
        { type: 'nav', label: 'Creator Dashboard', icon: '📊', onPress: () => navigation.navigate('CreatorDashboard') },
      ],
    },
    {
      title: 'Notifications',
      rows: [
        { type: 'toggle', label: 'Push Notifications', key: 'notifications', icon: '🔔' },
        { type: 'toggle', label: 'Weekly Reminder', key: 'weeklyReminder', icon: '📅', detail: 'Every Sunday at 9am' },
      ],
    },
    {
      title: 'Privacy',
      rows: [
        { type: 'toggle', label: 'Appear in Community Feed', key: 'communityVisible', icon: '👥' },
        { type: 'toggle', label: 'Face ID / Touch ID', key: 'faceID', icon: '🔐' },
      ],
    },
    {
      title: 'App',
      rows: [
        { type: 'toggle', label: 'Haptic Feedback', key: 'haptics', icon: '📳' },
        { type: 'nav', label: 'Monthly Check-In', icon: '📋', onPress: () => navigation.navigate('MonthlyCheckIn') },
        { type: 'nav', label: 'Subscription Audit', icon: '🗂️', onPress: () => navigation.navigate('SubscriptionAudit') },
      ],
    },
    {
      title: 'Support',
      rows: [
        { type: 'nav', label: 'Help & FAQ', icon: '❓', onPress: () => navigation.navigate('HelpFAQ') },
        { type: 'nav', label: 'Privacy Policy', icon: '🔒', onPress: () => navigation.navigate('PrivacyPolicy') },
        { type: 'nav', label: 'Terms of Service', icon: '📄', onPress: () => navigation.navigate('TermsOfService') },
        { type: 'nav', label: 'Rate Am I Broke?', icon: '⭐', onPress: () => Linking.openURL('https://apps.apple.com/app/am-i-broke/id123456789') },
      ],
    },
    {
      title: 'Danger Zone',
      rows: [
        { type: 'action', label: 'Clear Analysis History', icon: '🗑️', destructive: true, onPress: () => Alert.alert('Clear History?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => {} }]) },
        { type: 'action', label: 'Delete Account', icon: '❌', destructive: true, onPress: () => Alert.alert('Delete Account?', 'All your data will be permanently deleted.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {} }]) },
      ],
    },
  ];

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* App version header */}
        <View style={styles.appInfo}>
          <View style={styles.appIcon}>
            <Text style={styles.appIconEmoji}>💸</Text>
          </View>
          <Text style={styles.appName}>Am I Broke?</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>

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
                          <Text style={styles.cellIcon}>{row.icon}</Text>
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
                          <Switch
                            value={toggles[row.key as keyof typeof toggles]}
                            onValueChange={() => toggle(row.key)}
                            trackColor={{ false: Colors.backgroundSecondary, true: Colors.primarySolid }}
                            thumbColor="#fff"
                            ios_backgroundColor={Colors.backgroundSecondary}
                          />
                        )}
                        {(row.type === 'nav' || row.type === 'action') && (
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
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 8 },
  appInfo: { alignItems: 'center', marginBottom: 28, paddingTop: 8 },
  appIcon: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  appIconEmoji: { fontSize: 32 },
  appName: { fontFamily: Typography.fonts.heading, fontSize: 20, color: Colors.textPrimary, fontWeight: '700' },
  appVersion: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, paddingLeft: 4,
  },
  group: {
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 56 },
  cell: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingRight: 16, paddingVertical: 11, paddingLeft: 12,
    minHeight: 50,
  },
  cellLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  iconBadge: {
    width: 32, height: 32, borderRadius: 7,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeDanger: { backgroundColor: Colors.dangerContainer },
  cellIcon: { fontSize: 16 },
  cellLabel: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary },
  cellLabelDanger: { color: Colors.danger },
  cellDetail: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  cellRight: { marginLeft: 8 },
  chevronBtn: { padding: 4 },
  chevron: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
});
