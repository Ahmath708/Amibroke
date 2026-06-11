import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BellIcon } from 'react-native-heroicons/outline';
import { RootStackParamList } from '@/types';
import { Colors } from '@/theme/colors';
import { useNotifications } from '@/hooks/useNotifications';

/** Header bell → the notifications center, with an accent dot when there are pending nudges. */
export default function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items } = useNotifications();
  return (
    <PressableScale
      onPress={() => navigation.navigate('Notifications')}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.btn}
    >
      <BellIcon size={24} color={Colors.textPrimary} />
      {items.length > 0 && <View style={styles.dot} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 5,
    backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.background,
  },
});
