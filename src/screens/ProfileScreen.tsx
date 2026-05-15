import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import StatusPill from '../components/StatusPill';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'> };

const MENU_ITEMS = [
  { icon: '⭐', label: 'Subscription', detail: 'Free Plan', nav: 'Paywall' as const },
  { icon: '🎯', label: '90-Day Action Plan', detail: '3/8 complete', nav: 'ActionPlan' as const, params: { steps: [] } },
  { icon: '🎲', label: 'Scenario Simulator', nav: 'ScenarioSimulator' as const },
  { icon: '🗂️', label: 'Subscription Audit', nav: 'SubscriptionAudit' as const },
  { icon: '🤝', label: 'Affiliate Picks', nav: 'Affiliate' as const },
  { icon: '📊', label: 'Creator Dashboard', nav: 'CreatorDashboard' as const },
  { icon: '⚙️', label: 'Settings', nav: 'Settings' as const },
];

const STATS = [
  { label: 'Analyses', value: '4' },
  { label: 'Best Score', value: '61' },
  { label: 'Streak', value: '3 wks' },
  { label: 'Savings Goal', value: '$200' },
];

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [userName, setUserName] = useState('yourusername');
  const [isEditingName, setIsEditingName] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title */}
        <Text style={styles.largeTitle}>Profile</Text>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <TouchableOpacity onPress={pickImage}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarEmoji}>🤑</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.avatarInfo}>
            {isEditingName ? (
              <TextInput
                style={styles.nameInput}
                value={userName}
                onChangeText={setUserName}
                onBlur={() => setIsEditingName(false)}
                onSubmitEditing={() => setIsEditingName(false)}
                autoFocus
                selectTextOnFocus
              />
            ) : (
              <TouchableOpacity onPress={() => setIsEditingName(true)}>
                <Text style={styles.username}>@{userName}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.pillRow}>
              <StatusPill label="Free Plan" variant="muted" />
              <StatusPill label="4 Analyses" variant="info" />
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Paywall')}
            style={styles.upgradeBtn}
          >
            <Text style={styles.upgradeBtnText}>Upgrade ✨</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {STATS.map((s, i) => (
            <React.Fragment key={s.label}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              {i < STATS.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Current score */}
        <View style={styles.currentScore}>
          <View>
            <Text style={styles.currentScoreLabel}>Current Score</Text>
            <Text style={styles.currentScoreDate}>May 10, 2026</Text>
          </View>
          <View style={styles.currentScoreRight}>
            <Text style={[styles.currentScoreNum, { color: Colors.warning }]}>42</Text>
            <StatusPill label="Financially Fragile" variant="danger" />
          </View>
        </View>

        {/* Menu */}
        <Text style={styles.sectionLabel}>Quick Access</Text>
        <View style={styles.menuGroup}>
          {MENU_ITEMS.map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <View style={styles.menuSep} />}
              <TouchableOpacity
                style={styles.menuCell}
                onPress={() => (navigation.navigate as any)(item.nav, (item as any).params)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconBadge}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <View style={styles.menuRight}>
                  {item.detail && <Text style={styles.menuDetail}>{item.detail}</Text>}
                  <Text style={styles.menuChevron}>›</Text>
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  largeTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: 34, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: 0.37, marginBottom: 20,
  },
  avatarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 16,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarEmoji: { fontSize: 28 },
  nameInput: {
    fontFamily: Typography.fonts.headingSemi, fontSize: 17, color: Colors.textPrimary, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: Colors.primary, paddingVertical: 0, minWidth: 120,
  },
  avatarInfo: { flex: 1, gap: 6 },
  username: { fontFamily: Typography.fonts.headingSemi, fontSize: 17, color: Colors.textPrimary, fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: 6 },
  upgradeBtn: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 7,
  },
  upgradeBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.primary, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 16, paddingVertical: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: Typography.fonts.heading, fontSize: 20, color: Colors.textPrimary, fontWeight: '700' },
  statLabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginVertical: 6 },
  currentScore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 24,
  },
  currentScoreLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  currentScoreDate: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  currentScoreRight: { alignItems: 'flex-end', gap: 6 },
  currentScoreNum: { fontFamily: Typography.fonts.heading, fontSize: 36, fontWeight: '700' },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  menuGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 24,
  },
  menuSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 56 },
  menuCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12, minHeight: 50 },
  menuIconBadge: {
    width: 32, height: 32, borderRadius: 7,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIcon: { fontSize: 15 },
  menuLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuDetail: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
  menuChevron: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
  signOutBtn: { alignItems: 'center', paddingVertical: 16 },
  signOutText: { fontFamily: Typography.fonts.body, fontSize: 16, color: Colors.danger },
});
