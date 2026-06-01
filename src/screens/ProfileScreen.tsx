import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import StatusPill from '@/components/StatusPill';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile, getAnalysisHistory, uploadAvatar } from '@/services/claudeApi';
import { getSubscription, isSubscriptionPremium } from '@/services/subscriptions';
import { FEATURES } from '@/config/features';
import ScreenBackground from '@/components/ScreenBackground';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'> };

const BASE_MENU_ITEMS = [
  { icon: '💳', label: 'Subscription', detail: 'Free Plan', nav: 'Paywall' as const },
  { icon: '📋', label: '90-Day Action Plan', detail: '3/8 complete', nav: 'ActionPlan' as const, params: { steps: [] } },
  { icon: '🔮', label: 'Scenario Simulator', nav: 'ScenarioSimulator' as const },
  { icon: '🔍', label: 'Subscription Audit', nav: 'SubscriptionAudit' as const },
  { icon: '⚙️', label: 'Settings', nav: 'Settings' as const, detail: undefined },
];

const MENU_ITEMS = FEATURES.CREATOR_DASHBOARD
  ? [...BASE_MENU_ITEMS.slice(0, -1), { icon: '📈', label: 'Creator Dashboard', nav: 'CreatorDashboard' as const, detail: undefined }, ...BASE_MENU_ITEMS.slice(-1)]
  : BASE_MENU_ITEMS;

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [latestLabel, setLatestLabel] = useState('');
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [latestDate, setLatestDate] = useState('');
  const [purchaseTier, setPurchaseTier] = useState<'free' | 'action_plan' | 'deep_dive'>('free');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { animatedStyle } = useEntryAnimation();

  useEffect(() => {
    (async () => {
      const { tier } = await getSubscription(user?.id ?? '');
      setPurchaseTier(tier);
    })();
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profile, history] = await Promise.all([
        getProfile(user.id),
        getAnalysisHistory(user.id),
      ]);
      if (profile) {
        setUserName(profile.username || '');
        setDisplayName(profile.display_name || '');
        if (profile.avatar_url) setAvatarUri(profile.avatar_url);
      } else {
        // Fallback if profile row doesn't exist yet
        setUserName(user.email?.split('@')[0] || 'user');
        setDisplayName(user.email?.split('@')[0] || 'User');
      }
      if (history && history.length > 0) {
        setAnalysisCount(history.length);
        setLatestScore(history[0].score);
        setLatestLabel(history[0].score_label);
        setLatestDate(history[0].created_at);
        setBestScore(Math.max(...history.map((h) => h.score)));
      } else {
        setAnalysisCount(0);
        setLatestScore(null);
        setBestScore(null);
      }
    } catch {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const saveUsername = async () => {
    if (!user) return;
    setIsEditingName(false);
    const ok = await updateProfile(user.id, { username: userName, display_name: displayName });
    if (!ok) Alert.alert('Error', 'Failed to save profile.');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const pickImage = async () => {
    if (!user) return;
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
      const pickedUri = result.assets[0].uri;
      setUploadingAvatar(true);
      try {
        const publicUrl = await uploadAvatar(user.id, pickedUri);
        if (publicUrl) {
          setAvatarUri(publicUrl);
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to upload profile picture.');
        }
      } catch (err) {
        console.warn(err);
        Alert.alert('Error', 'An error occurred while uploading.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const scoreColor = !latestScore ? Colors.textMuted : latestScore < 40 ? Colors.danger : latestScore < 65 ? Colors.warning : Colors.success;
  const scoreVariant = !latestScore ? 'muted' as const : latestScore < 40 ? 'danger' as const : latestScore < 65 ? 'warning' as const : 'good' as const;

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingState style={{ paddingTop: insets.top + 80 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={fetchData} style={{ paddingTop: insets.top + 80 }} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="profile" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title */}
        <Text style={styles.largeTitle}>Profile</Text>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <TouchableOpacity onPress={pickImage} disabled={uploadingAvatar}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={[styles.avatarImage, uploadingAvatar && { opacity: 0.4 }]} />
              ) : (
                <Text style={[styles.avatarEmoji, uploadingAvatar && { opacity: 0.4 }]}>💸</Text>
              )}
              {uploadingAvatar && (
                <ActivityIndicator size="small" color="#fff" style={StyleSheet.absoluteFill} />
              )}
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.avatarInfo}>
            {isEditingName ? (
              <TextInput
                style={styles.nameInput}
                value={userName}
                onChangeText={setUserName}
                onBlur={saveUsername}
                onSubmitEditing={saveUsername}
                autoFocus
                selectTextOnFocus
              />
            ) : (
              <TouchableOpacity onPress={() => setIsEditingName(true)}>
                <Text style={styles.username}>{userName ? `@${userName}` : user?.email || 'Guest'}</Text>
              </TouchableOpacity>
            )}
            {user && (
              <StatusPill
                label={purchaseTier === 'deep_dive' ? 'Deep Dive' : purchaseTier === 'action_plan' ? 'Action Plan' : 'Free Plan'}
                variant={isSubscriptionPremium(purchaseTier) ? 'good' : 'muted'}
              />
            )}
          </View>
        </View>

        {/* Upgrade CTA — separate from avatar card */}
        {user && !isSubscriptionPremium(purchaseTier) && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Paywall')}
            style={styles.upgradeCta}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['rgba(189,0,255,0.25)', 'rgba(231,0,110,0.20)']} style={styles.upgradeCtaGradient}>
              <Text style={styles.upgradeCtaTitle}>✨ Unlock Premium</Text>
              <Text style={styles.upgradeCtaBody}>Debt payoff planner, scenario simulator & more.</Text>
              <View style={styles.upgradeCtaArrow}>
                <Text style={styles.upgradeCtaChevron}>›</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Stats row */}
{user && (
  <View style={styles.statsRow}>
    {[
      { label: 'Best Score', value: bestScore != null ? String(bestScore) : '—' },
    ].map((s, i, arr) => (
      <React.Fragment key={s.label}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
        {i < arr.length - 1 && <View style={styles.statDivider} />}
      </React.Fragment>
    ))}
  </View>
)}

        {/* Current score */}
        {latestScore != null && (
          <View style={styles.currentScore}>
            <View>
              <Text style={styles.currentScoreLabel}>Current Score</Text>
              <Text style={styles.currentScoreDate}>{fmtDate(latestDate)}</Text>
            </View>
            <View style={styles.currentScoreRight}>
              <Text style={[styles.currentScoreNum, { color: scoreColor }]}>{latestScore}</Text>
              <StatusPill label={latestLabel} variant={scoreVariant} />
            </View>
          </View>
        )}

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
        {user && (
          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.7} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  largeTitle: {
    fontFamily: Typography.fonts.heading,
    ...Typography.largeTitle,
    color: Colors.textPrimary, marginBottom: Spacing.xl,
  },
  avatarCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.lg,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarEmoji: { fontSize: Typography.title2.fontSize },
  nameInput: {
    fontFamily: Typography.fonts.headingSemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: Colors.primary, paddingVertical: 0, minWidth: 120,
  },
  avatarInfo: { flex: 1, gap: Spacing.xs },
  username: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, fontWeight: '600' },
  upgradeCta: { marginBottom: Spacing.lg },
  upgradeCtaGradient: {
    flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  upgradeCtaTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.subhead.fontSize, color: Colors.primary, fontWeight: '600' },
  upgradeCtaBody: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, flex: 1, lineHeight: 17, marginTop: 2 },
  upgradeCtaArrow: { marginLeft: Spacing.sm },
  upgradeCtaChevron: { fontSize: 26, color: Colors.primary, fontWeight: '300' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.lg, paddingVertical: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, fontWeight: '700' },
  statLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginVertical: Spacing.xs },
  currentScore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.xxl,
  },
  currentScoreLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  currentScoreDate: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
  currentScoreRight: { alignItems: 'flex-end', gap: Spacing.xs },
  currentScoreNum: { fontFamily: Typography.fonts.heading, fontSize: 36, fontWeight: '700' },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  menuGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.xxl,
  },
  menuSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.rowHeightLg },
  menuCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md, minHeight: 50 },
  menuIconBadge: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIcon: { fontSize: Typography.subhead.fontSize },
  menuLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  menuDetail: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  menuChevron: { fontSize: Typography.title2.fontSize, color: Colors.textMuted, fontWeight: '300' },
  signOutBtn: { alignItems: 'center', paddingVertical: Spacing.lg },
  signOutText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.danger },
  });