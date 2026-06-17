import React from 'react';
import {
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '@/components/motion';
import { Colors, Radius, Spacing, Typography } from '@/theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tinted' | 'plain' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: string;
  /** Soft pink glow under a primary CTA (the design's hero-button bloom). Suppressed when disabled. */
  glow?: boolean;
}

export default function NeonButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  style,
  icon,
  glow,
}: Props) {
  const handlePress = () => {
    if (disabled || loading) return;
    onPress();
  };
  // Primary CTA gets a firmer tap; supporting buttons a light one. PressableScale
  // adds the spring press + haptic (and skips both under Reduce Motion).
  const haptic = variant === 'primary' ? 'medium' : 'light';

  const heights = { lg: 56, md: 44, sm: 36 };
  const fontSizes = { lg: 17, md: 15, sm: 13 };

  if (variant === 'primary') {
    const showGlow = glow && !disabled && !loading;
    return (
      <PressableScale
        onPress={handlePress}
        disabled={disabled || loading}
        haptic={haptic}
        style={[styles.wrapper, showGlow && styles.glow, style]}
      >
        {/* Claude Design disabled = the same accent fill at 42% (no gray swap, no glow). */}
        <LinearGradient
          colors={Colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { height: heights[size], borderRadius: Radius.xl }, disabled && styles.baseDisabled]}
        >
          {loading
            ? <ActivityIndicator color={Colors.onAccent} />
            : <View style={styles.inner}>
                {icon ? <Text style={styles.icon}>{icon}</Text> : null}
                <Text style={[styles.label, { fontSize: fontSizes[size] }]}>
                  {label}
                </Text>
              </View>
          }
        </LinearGradient>
      </PressableScale>
    );
  }

  if (variant === 'secondary') {
    return (
      <PressableScale
        onPress={handlePress}
        disabled={disabled || loading}
        haptic={haptic}
        style={[styles.secondaryBtn, { height: heights[size] }, style]}
      >
        {loading
          ? <ActivityIndicator color={Colors.accent} />
          : <View style={styles.inner}>
              {icon ? <Text style={styles.icon}>{icon}</Text> : null}
              <Text style={[styles.secondaryLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
            </View>
        }
      </PressableScale>
    );
  }

  if (variant === 'tinted') {
    return (
      <PressableScale
        onPress={handlePress}
        disabled={disabled || loading}
        haptic={haptic}
        style={[styles.tintedBtn, { height: heights[size] }, style]}
      >
        <View style={styles.inner}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={[styles.tintedLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
        </View>
      </PressableScale>
    );
  }

  if (variant === 'danger') {
    return (
      <PressableScale
        onPress={handlePress}
        disabled={disabled || loading}
        haptic={haptic}
        style={[styles.dangerBtn, { height: heights[size] }, style]}
      >
        <View style={styles.inner}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={[styles.dangerLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={handlePress} disabled={disabled} haptic={haptic} style={[styles.wrapper, style]}>
      <Text style={[styles.plainLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  // Soft pink bloom under the CTA (opt-in via `glow`; the design's hero-button shadow).
  glow: {
    shadowColor: Colors.accentSolid,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 17,
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Disabled = the accent fill dimmed to 42% (Claude Design), label dims with it.
  baseDisabled: {
    opacity: 0.42,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  icon: { fontSize: 17 },
  label: {
    fontFamily: Typography.fonts.bodySemi,
    color: Colors.onAccent, // contrast-safe on the accent fill (white on magenta, dark on lime)
    fontWeight: '600',
    letterSpacing: -0.3,
  },

  secondaryBtn: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.accentContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  secondaryLabel: {
    fontFamily: Typography.fonts.bodySemi,
    color: Colors.accent,
    fontWeight: '600',
  },

  tintedBtn: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.accentContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  tintedLabel: {
    fontFamily: Typography.fonts.bodyMed,
    color: Colors.accent,
    fontWeight: '500',
  },

  dangerBtn: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.dangerContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  dangerLabel: {
    fontFamily: Typography.fonts.bodyMed,
    color: Colors.danger,
    fontWeight: '500',
  },

  plainLabel: {
    fontFamily: Typography.fonts.body,
    color: Colors.accent,
    textAlign: 'center',
    paddingVertical: Spacing.sm + 2,
  },
});
