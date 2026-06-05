import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile } from '@/services/profile';
import ScreenBackground from '@/components/ScreenBackground';
import SectionLabel from '@/components/SectionLabel';
import AppTextInput from '@/components/AppTextInput';
import NeonButton from '@/components/NeonButton';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'EditProfile'> };

function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <AppTextInput style={styles.fieldInput} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

export default function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, supabase } = useAuth();
  // Google/OAuth users don't manage email + password in-app — only email/password accounts do.
  const isEmailUser = user?.app_metadata?.provider === 'email';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [origUsername, setOrigUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Sign-in section: current password gates both an email and a password change.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((p) => {
      setFirstName(p?.first_name ?? '');
      setLastName(p?.last_name ?? '');
      setUsername(p?.username ?? '');
      setOrigUsername(p?.username ?? '');
    }).catch(() => {});
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const uname = username.trim().toLowerCase();
      if (uname && uname !== origUsername) {
        const { data: avail } = await supabase.rpc('is_username_available', { p_username: uname });
        if (avail === false) { Alert.alert('Username taken', 'Pick a different username.'); return; }
      }
      const ok = await updateProfile(user.id, {
        first_name: firstName.trim(), last_name: lastName.trim(), ...(uname ? { username: uname } : {}),
      });
      if (ok) { setOrigUsername(uname); Alert.alert('Saved', 'Your profile is updated.'); }
      else Alert.alert('Couldn’t save', 'The username may be taken. Try again.');
    } finally { setSavingProfile(false); }
  };

  // Re-authenticate with the current password before any email/password change.
  const verifyCurrent = async (): Promise<boolean> => {
    if (!currentPassword) { Alert.alert('Current password needed', 'Enter your current password to make this change.'); return false; }
    const { error } = await supabase.auth.signInWithPassword({ email: user!.email!, password: currentPassword });
    if (error) { Alert.alert('Incorrect password', 'That current password isn’t right.'); return false; }
    return true;
  };

  const changeEmail = async () => {
    if (!newEmail.trim()) { Alert.alert('Enter a new email'); return; }
    setBusy(true);
    try {
      if (!(await verifyCurrent())) return;
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) { Alert.alert('Couldn’t update email', error.message); return; }
      setNewEmail(''); setCurrentPassword('');
      Alert.alert('Confirm your new email', 'We sent a confirmation link to the new address — the change takes effect once you confirm it.');
    } finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { Alert.alert('Too short', 'Use at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Passwords don’t match', 'Re-enter the new password.'); return; }
    setBusy(true);
    try {
      if (!(await verifyCurrent())) return;
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { Alert.alert('Couldn’t update password', error.message); return; }
      setNewPassword(''); setConfirmPassword(''); setCurrentPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionLabel>Profile</SectionLabel>
        <View style={styles.group}>
          <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="First" autoCapitalize="words" />
          <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Last" autoCapitalize="words" />
          <Field label="Username" value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" autoCorrect={false} />
        </View>
        <NeonButton label={savingProfile ? 'Saving…' : 'Save'} onPress={saveProfile} loading={savingProfile} style={styles.cta} />

        {isEmailUser && (
          <>
            <SectionLabel style={{ marginTop: Spacing.xxl }}>Sign-in</SectionLabel>
            <Text style={styles.sectionHint}>Enter your current password to change your email or password.</Text>
            <View style={styles.group}>
              <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="••••••••" secureTextEntry autoCapitalize="none" />
            </View>

            <View style={styles.group}>
              <Field label="New email" value={newEmail} onChangeText={setNewEmail} placeholder={user?.email ?? 'you@email.com'} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>
            <NeonButton label="Update email" onPress={changeEmail} loading={busy} variant="secondary" style={styles.cta} />

            <View style={styles.group}>
              <Field label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
              <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter" secureTextEntry autoCapitalize="none" />
            </View>
            <NeonButton label="Update password" onPress={changePassword} loading={busy} variant="secondary" style={styles.cta} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  group: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight, marginBottom: Spacing.md,
  },
  field: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  fieldLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginBottom: 2 },
  fieldInput: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, paddingVertical: 4 },
  cta: { marginBottom: Spacing.sm },
  sectionHint: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 18 },
});
