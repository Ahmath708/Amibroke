import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';

export type ScreenVariant =
  | 'home' | 'results' | 'profile' | 'settings'
  | 'history' | 'community' | 'paywall' | 'processing'
  | 'onboarding' | 'login' | 'splash' | 'share'
  | 'subscriptions' | 'scenarios' | 'debt'
  | 'actionPlan' | 'creator' | 'checkin' | 'info';

const THEMES: Record<ScreenVariant, { gradient: [string, string]; accent: string; orbs: { colors: [string, string]; top?: number; bottom?: number; left?: number; right?: number; size: number }[] }> = {
  home: {
    gradient: ['#19101c', '#1f0a2e'],
    accent: Colors.primary,
    orbs: [
      { colors: ['#bd00ff', '#7c00cc'], top: -100, left: -80, size: 320 },
      { colors: ['#e7006e', '#bd00ff'], top: -60, right: -60, size: 260 },
    ],
  },
  results: {
    gradient: ['#0d001a', '#1a0026'],
    accent: Colors.secondary,
    orbs: [
      { colors: ['#00e0ff', '#0060cc'], top: -120, right: -40, size: 300 },
      { colors: ['#bd00ff', '#7c00cc'], bottom: -80, left: -60, size: 280 },
    ],
  },
  profile: {
    gradient: ['#1a0010', '#19101c'],
    accent: Colors.tertiary,
    orbs: [
      { colors: ['#e7006e', '#bd00ff'], top: -80, right: -50, size: 280 },
      { colors: ['#bd00ff', '#7c00cc'], bottom: -100, left: -40, size: 300 },
    ],
  },
  settings: {
    gradient: ['#130b16', '#19101c'],
    accent: Colors.textMuted,
    orbs: [
      { colors: ['#4a3d4d', '#2d1f30'], top: -60, left: -60, size: 240 },
      { colors: ['#6e5f71', '#4a3d4d'], bottom: -80, right: -40, size: 260 },
    ],
  },
  history: {
    gradient: ['#001a26', '#0d001a'],
    accent: Colors.secondary,
    orbs: [
      { colors: ['#00e0ff', '#0060cc'], top: -100, left: -30, size: 300 },
      { colors: ['#0080ff', '#0040aa'], bottom: -60, right: -60, size: 250 },
    ],
  },
  community: {
    gradient: ['#1a0010', '#190826'],
    accent: Colors.tertiary,
    orbs: [
      { colors: ['#e7006e', '#bd00ff'], top: -90, left: -50, size: 300 },
      { colors: ['#ffb1c3', '#e7006e'], bottom: -70, right: -40, size: 260 },
    ],
  },
  paywall: {
    gradient: ['#1a0026', '#0d001a'],
    accent: '#ffd700',
    orbs: [
      { colors: ['#bd00ff', '#e7006e'], top: -100, left: -40, size: 340 },
      { colors: ['#ffd700', '#ff8c00'], bottom: -80, right: -50, size: 280 },
    ],
  },
  processing: {
    gradient: ['#0d001a', '#1a0026'],
    accent: Colors.primary,
    orbs: [
      { colors: ['#bd00ff', '#e7006e'], top: -60, left: -60, size: 300 },
      { colors: ['#00e0ff', '#0080ff'], bottom: -60, right: -60, size: 300 },
    ],
  },
  onboarding: {
    gradient: ['#1a0026', '#19101c'],
    accent: Colors.primary,
    orbs: [
      { colors: ['#bd00ff', '#e7006e'], top: -80, left: -40, size: 350 },
      { colors: ['#00e0ff', '#0060cc'], bottom: -100, right: -30, size: 300 },
    ],
  },
  login: {
    gradient: ['#130b16', '#1a0026'],
    accent: Colors.primary,
    orbs: [
      { colors: ['#bd00ff', '#7c00cc'], top: -100, left: -50, size: 320 },
      { colors: ['#e7006e', '#bd00ff'], bottom: -80, right: -40, size: 270 },
    ],
  },
  splash: {
    gradient: ['#0d001a', '#1a0026'],
    accent: Colors.primary,
    orbs: [
      { colors: ['#bd00ff', '#e7006e'], top: -60, left: -80, size: 400 },
      { colors: ['#00e0ff', '#0060cc'], bottom: -80, right: -50, size: 300 },
    ],
  },
  share: {
    gradient: ['#0d001a', '#001a26'],
    accent: Colors.secondary,
    orbs: [
      { colors: ['#00e0ff', '#0080ff'], top: -80, left: -40, size: 280 },
      { colors: ['#bd00ff', '#7c00cc'], bottom: -60, right: -50, size: 250 },
    ],
  },
  subscriptions: {
    gradient: ['#1a0010', '#19101c'],
    accent: Colors.warning,
    orbs: [
      { colors: ['#ff6b00', '#e7006e'], top: -70, right: -50, size: 260 },
      { colors: ['#bd00ff', '#7c00cc'], bottom: -90, left: -40, size: 290 },
    ],
  },
  scenarios: {
    gradient: ['#001a26', '#0d001a'],
    accent: Colors.secondary,
    orbs: [
      { colors: ['#00e0ff', '#39FF14'], top: -90, left: -30, size: 280 },
      { colors: ['#0080ff', '#0040aa'], bottom: -70, right: -50, size: 260 },
    ],
  },
  debt: {
    gradient: ['#1a0000', '#1a0010'],
    accent: Colors.danger,
    orbs: [
      { colors: ['#ff453a', '#e7006e'], top: -80, left: -40, size: 280 },
      { colors: ['#ff6b00', '#ff453a'], bottom: -60, right: -50, size: 260 },
    ],
  },
  actionPlan: {
    gradient: ['#001a0d', '#0d001a'],
    accent: Colors.success,
    orbs: [
      { colors: ['#39FF14', '#00e0ff'], top: -90, left: -30, size: 290 },
      { colors: ['#00e0ff', '#0080ff'], bottom: -70, right: -50, size: 260 },
    ],
  },
  creator: {
    gradient: ['#1a0026', '#001a26'],
    accent: Colors.primary,
    orbs: [
      { colors: ['#bd00ff', '#e7006e'], top: -80, left: -40, size: 300 },
      { colors: ['#00e0ff', '#0080ff'], bottom: -60, right: -50, size: 250 },
    ],
  },
  checkin: {
    gradient: ['#1a0010', '#19101c'],
    accent: Colors.tertiary,
    orbs: [
      { colors: ['#ffb1c3', '#e7006e'], top: -70, left: -40, size: 260 },
      { colors: ['#bd00ff', '#7c00cc'], bottom: -80, right: -30, size: 270 },
    ],
  },
  info: {
    gradient: ['#130b16', '#19101c'],
    accent: Colors.textMuted,
    orbs: [
      { colors: ['#4a3d4d', '#2d1f30'], top: -60, left: -50, size: 240 },
      { colors: ['#6e5f71', '#4a3d4d'], bottom: -70, right: -40, size: 250 },
    ],
  },
};

interface Props {
  variant: ScreenVariant;
}

export default function ScreenBackground({ variant }: Props) {
  const theme = THEMES[variant];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={theme.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {theme.orbs.map((orb, i) => (
        <View
          key={i}
          style={[
            styles.orb,
            {
              width: orb.size,
              height: orb.size,
              top: orb.top,
              left: orb.left,
              right: orb.right,
              opacity: 0.12,
            },
          ]}
        >
          <LinearGradient
            colors={orb.colors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    overflow: 'hidden',
  },
});
