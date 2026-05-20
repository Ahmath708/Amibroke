import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';

interface Props {
  size?: number | 'small' | 'large';
  color?: string;
  style?: any;
}

export default function LoadingState({ size = 'large', color = Colors.primary, style }: Props) {
  return (
    <View style={[styles.center, style]}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
