import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SCREEN_VARIANTS, type ScreenVariant } from '@/theme/screenVariants';

export type { ScreenVariant };

interface Props {
  variant: ScreenVariant;
}

export default function ScreenBackground({ variant }: Props) {
  const theme = SCREEN_VARIANTS[variant];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={theme.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {(theme.orbs ?? []).map((orb, i) => (
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
