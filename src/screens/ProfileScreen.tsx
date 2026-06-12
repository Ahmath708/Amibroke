import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp, PressableScale } from '@/components/motion';
import AccountSettings from '@/components/AccountSettings';
import AppTextInput from '@/components/AppTextInput';
import { capitalize } from '@/utils/string';
import Toast from '@/components/Toast';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { PencilSquareIcon } from 'react-native-heroicons/outline';
import TierPill from '@/components/TierPill';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile, uploadAvatar } from '@/services/profile';
import { useSubscription } from '@/hooks/useSubscription';
import ScreenBackground from '@/components/ScreenBackground';
import TopScrim from '@/components/TopScrim';
import { UserIcon } from 'react-native-heroicons/solid';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };



export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true); // gate the full-screen loader to the first load only
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
      const profile = await getProfile(user.id);
      if (profile) {
        setUserName(profile.username || '');
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        if (profile.avatar_url) setAvatarUri(profile.avatar_url);
      } else {
        // Fallback if profile row doesn't exist yet
        setUserName(user.email?.split('@')[0] || 'user');
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
    const ok = await updateProfile(user.id, { username: userName });
    if (!ok) Alert.alert('Error', 'Failed to save profile.');
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
          setToast('Profile picture updated');
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

  const fullName = [firstName, lastName].map((s) => s.trim()).filter(Boolean).map(capitalize).join(' ');

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="profile" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title */}
        <Text style={styles.largeTitle}>Your Profile</Text>

        {/* Hero — identity + stats in one glowing card; pencil = edit profile */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[Colors.accentContainer, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.65, y: 0.6 }}
            style={styles.heroGlow}
            pointerEvents="none"
          />
          <View style={styles.heroTop}>
            <PressableScale onPress={pickImage} disabled={uploadingAvatar}>
              <LinearGradient colors={Colors.gradientPrimary} style={styles.avatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={[styles.avatarImage, uploadingAvatar && { opacity: 0.4 }]} />
                ) : (
                  <UserIcon size={30} color={uploadingAvatar ? 'rgba(255,255,255,0.4)' : Colors.onAccent} />
                )}
                {uploadingAvatar && (
                  <ActivityIndicator size="small" color={Colors.onAccent} style={StyleSheet.absoluteFill} />
                )}
              </LinearGradient>
            </PressableScale>
            <View style={styles.avatarInfo}>
              {fullName ? <Text style={styles.fullName}>{fullName}</Text> : null}
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
                <PressableScale onPress={() => setIsEditingName(true)}>
                  <Text style={fullName ? styles.username : styles.fullName}>{userName ? `@${userName}` : user?.email || 'Guest'}</Text>
                </PressableScale>
              )}
              {user && <View style={styles.heroTier}><TierPill tier={purchaseTier} size="md" /></View>}
            </View>
            {user && (
              <PressableScale onPress={() => navigation.navigate('EditProfile')} style={styles.heroEdit} accessibilityLabel="Edit profile">
                <PencilSquareIcon size={18} color={Colors.accentSolid} />
              </PressableScale>
            )}
          </View>
        </View>

        {/* Account + settings — the full account hub lives here (no separate Settings screen) */}
        <AccountSettings navigation={navigation} />
      </ScrollView>
      <TopScrim variant="profile" />
      <Toast message={toast ?? ''} emoji="✅" visible={!!toast} onHide={() => setToast(null)} />
    </ReAnimated.View>
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
  hero: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xxl, gap: Spacing.lg,
  },
  heroGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroEdit: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
    backgroundColor: Colors.accentContainer,
  },
  heroTier: { alignSelf: 'flex-start', marginTop: 2 },
  avatar: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accentSolid, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 14, elevation: 8,
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  nameInput: {
    fontFamily: Typography.fonts.headingSemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: Colors.accent, paddingVertical: 0, minWidth: 120,
  },
  avatarInfo: { flex: 1, gap: Spacing.xs },
  fullName: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, fontWeight: '700' },
  username: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
});