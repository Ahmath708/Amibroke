import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Typography } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tinted' | 'plain' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: string;
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
}: Props) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const heights = { lg: 56, md: 44, sm: 36 };
  const fontSizes = { lg: 17, md: 15, sm: 13 };

  if (variant === 'primary') {
    return (
      <TouchableOpacity onPress={handlePress} disabled={disabled || loading} style={[styles.wrapper, style]} activeOpacity={0.85}>
        <LinearGradient
          colors={disabled ? ['#3a2540', '#3a2540'] : Colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { height: heights[size], borderRadius: Radius.xl }]}
        >
          {loading
            ? <ActivityIndicator color={Colors.textPrimary} />
            : <View style={styles.inner}>
                {icon ? <Text style={styles.icon}>{icon}</Text> : null}
                <Text style={[styles.label, { fontSize: fontSizes[size] }, disabled && styles.labelDisabled]}>
                  {label}
                </Text>
              </View>
          }
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.75}
        style={[styles.secondaryBtn, { height: heights[size] }, style]}
      >
        {loading
          ? <ActivityIndicator color={Colors.primary} />
          : <View style={styles.inner}>
              {icon ? <Text style={styles.icon}>{icon}</Text> : null}
              <Text style={[styles.secondaryLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
            </View>
        }
      </TouchableOpacity>
    );
  }

  if (variant === 'tinted') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.75}
        style={[styles.tintedBtn, { height: heights[size] }, style]}
      >
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.tintedLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'danger') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.75}
        style={[styles.dangerBtn, { height: heights[size] }, style]}
      >
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.dangerLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  // plain
  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.5} style={[styles.wrapper, style]}>
      <Text style={[styles.plainLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 17 },
  label: {
    fontFamily: Typography.fonts.bodySemi,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  labelDisabled: { opacity: 0.45 },

  secondaryBtn: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.glassBorderLight,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryLabel: {
    fontFamily: Typography.fonts.bodySemi,
    color: Colors.primary,
    fontWeight: '600',
  },

  tintedBtn: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tintedLabel: {
    fontFamily: Typography.fonts.bodyMed,
    color: Colors.primary,
    fontWeight: '500',
  },

  dangerBtn: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.dangerContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dangerLabel: {
    fontFamily: Typography.fonts.bodyMed,
    color: Colors.danger,
    fontWeight: '500',
  },

  plainLabel: {
    fontFamily: Typography.fonts.body,
    color: Colors.tint,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
