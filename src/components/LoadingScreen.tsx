import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenBackground, { type ScreenVariant } from '@/components/ScreenBackground';
import LoadingState from '@/components/LoadingState';

// Full-screen loading state: the SOLID screen background + a centered spinner. Use this (not a bare
// <LoadingState/>) whenever a screen fetches before it can render — otherwise the loader floats over
// a transparent view and the PREVIOUS screen bleeds through, which reads as broken/amateurish.
export default function LoadingScreen({ variant }: { variant: ScreenVariant }) {
  return (
    <View style={styles.fill}>
      <ScreenBackground variant={variant} />
      <LoadingState />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
