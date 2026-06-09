import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, Animated,
} from 'react-native';
import SectionLabel from '@/components/SectionLabel';
import AppTextInput from '@/components/AppTextInput';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import MiniScoreRing from '@/components/MiniScoreRing';
import { Ionicons } from '@expo/vector-icons';
import StatusPill from '@/components/StatusPill';
import TierPill from '@/components/TierPill';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile, uploadAvatar } from '@/services/profile';
import { getAnalysisHistory } from '@/services/analyses';
import { formatLongDate as fmtDate } from '@/utils/format';
import { isSubscriptionPremium } from '@/services/subscriptions';
import { manageSubscriptions } from '@/services/purchases';
import { useSubscription } from '@/hooks/useSubscription';
import { FEATURES } from '@/config/features';
import ScreenBackground from '@/components/ScreenBackground';
import { UserIcon } from 'react-native-heroicons/solid';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

// Account / app items (always available).
const ACCOUNT_ITEMS: { icon: string; label: string; nav: string }[] = [
  { icon: 'person-outline', label: 'Edit Profile', nav: 'EditProfile' },
  { icon: 'card-outline', label: 'Your Plan', nav: 'Paywall' }, // premium→manage, free→Paywall; detail = live tier (see render)
  ...(FEATURES.CREATOR_DASHBOARD ? [{ icon: 'trending-up-outline', label: 'Creator Dashboard', nav: 'CreatorDashboard' }] : []),
  { icon: 'settings-outline', label: 'Settings', nav: 'Settings' },
];


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
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const firstLoad = useRef(true); // gate the full-screen loader to the first load only
  const [latestDate, setLatestDate] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { animatedStyle } = useEntryAnimation();
  // Shared hook → live customerInfo listener, so the tier updates the moment a
  // purchase lands (the old one-shot fetch left Profile stuck on the old tier).
  const { tier: purchaseTier, refresh: refreshSub } = useSubscription();

  const fetchData = useCallback(async (silent = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true); // silent refetches (focus) keep content mounted — no flash, scroll preserved
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
        setLatestDate(history[0].created_at);
        setBestScore(Math.max(...history.map((h) => h.score)));
        setAvgScore(Math.round(history.reduce((s, h) => s + h.score, 0) / history.length));
      } else {
        setAnalysisCount(0);
        setLatestScore(null);
        setBestScore(null);
        setAvgScore(null);
      }
    } catch {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData(!firstLoad.current); // first focus shows the loader; later focuses refresh silently
      firstLoad.current = false;
      refreshSub(); // re-resolve tier on focus (e.g. returning from the Paywall)
    }, [fetchData, refreshSub])
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


  const scoreColor = latestScore == null ? Colors.textMuted : getScoreBand(latestScore).color;

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
        <ErrorState message={error} onRetry={() => fetchData()} style={{ paddingTop: insets.top + 80 }} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="profile" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
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
                <UserIcon size={30} color={uploadingAvatar ? 'rgba(255,255,255,0.4)' : '#fff'} />
              )}
              {uploadingAvatar && (
                <ActivityIndicator size="small" color="#fff" style={StyleSheet.absoluteFill} />
              )}
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.avatarInfo}>
            {isEditingName ? (
              <AppTextInput
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
              <TierPill tier={purchaseTier} />
            )}
          </View>
        </View>

        {/* Stats row */}
{user && (
  <View style={styles.statsRow}>
    {[
      { label: 'Roasts', value: String(analysisCount) },
      { label: 'Avg Score', value: avgScore != null ? String(avgScore) : '—' },
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
              <MiniScoreRing score={latestScore} size={56} stroke={5} numberSize={Typography.title3.fontSize} />
              <StatusPill label={getScoreBand(latestScore).label} color={scoreColor} />
            </View>
          </View>
        )}

        {/* Menu */}
        <SectionLabel>Quick Access</SectionLabel>
        <View style={styles.menuGroup}>
          {ACCOUNT_ITEMS.map((item, i) => {
            const isPlan = item.label === 'Your Plan';
            const detail = (item as any).detail;
            const onPress = isPlan
              ? () => {
                  // Subscribed → native manage sheet (cancel/change); free → the paywall.
                  if (isSubscriptionPremium(purchaseTier)) manageSubscriptions();
                  else navigation.navigate('Paywall');
                }
              : () => (navigation.navigate as any)(item.nav, (item as any).params);
            return (
              <React.Fragment key={item.label}>
                {i > 0 && <View style={styles.menuSep} />}
                <TouchableOpacity
                  style={styles.menuCell}
                  onPress={onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconBadge}>
                    <Ionicons name={item.icon as any} size={18} color={Colors.accent} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <View style={styles.menuRight}>
                    {isPlan ? <TierPill tier={purchaseTier} size="md" /> : detail ? <Text style={styles.menuDetail}>{detail}</Text> : null}
                    <Text style={styles.menuChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
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
  largeTitle: {
    fontFamily: Typography.fonts.heading,
    ...Typography.largeTitle,
    color: Colors.textPrimary, marginBottom: Spacing.xl,
  },
  avatarCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.lg,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  nameInput: {
    fontFamily: Typography.fonts.headingSemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: Colors.accent, paddingVertical: 0, minWidth: 120,
  },
  avatarInfo: { flex: 1, gap: Spacing.xs },
  username: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.lg, paddingVertical: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, fontWeight: '700' },
  statLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginVertical: Spacing.xs },
  currentScore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xxl,
  },
  currentScoreLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  currentScoreDate: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
  currentScoreRight: { alignItems: 'flex-end', gap: Spacing.xs },
  menuGroup: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xxl,
  },
  menuSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.rowHeightLg },
  menuCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md, minHeight: 50 },
  menuIconBadge: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.accentContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  menuDetail: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  menuChevron: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '300' },
  signOutBtn: {
    alignItems: 'center', paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,69,58,0.35)',
    backgroundColor: Colors.dangerContainer,
  },
  signOutText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.danger },
  });