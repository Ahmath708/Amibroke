import React, { useCallback, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserIcon } from 'react-native-heroicons/outline';
import { useFocusEffect } from '@react-navigation/native';
import { PressableScale } from '@/components/motion';
import { Colors } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import { getProfile } from '@/services/claudeApi';

/**
 * The account avatar (Cash App-style top-right). Self-fetches the user's avatar so
 * it can drop into any tab header for consistent Profile access. Tap → Profile.
 */
export default function ProfileAvatarButton({ onPress }: { onPress: () => void }) {
  const { user } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (user) {
        getProfile(user.id)
          .then((p) => { if (active) setAvatarUri(p?.avatar_url ?? null); })
          .catch(() => {});
      }
      return () => { active = false; };
    }, [user]),
  );

  return (
    <PressableScale onPress={onPress} haptic="light" accessibilityLabel="Profile">
      <LinearGradient colors={Colors.gradientPrimary} style={styles.avatar}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          : <UserIcon size={18} color={Colors.onAccent} />}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
});
