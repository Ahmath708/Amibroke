import React from 'react';
import {
  TouchableOpacity,
  TouchableNativeFeedback,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  View,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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
}

const Touchable = Platform.OS === 'android' ? TouchableNativeFeedback : TouchableOpacity;

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
      <Touchable onPress={handlePress} disabled={disabled || loading} style={[styles.wrapper, style]}>
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
      </Touchable>
    );
  }

  if (variant === 'secondary') {
    return (
      <Touchable
        onPress={handlePress}
        disabled={disabled || loading}
        style={[styles.secondaryBtn, { height: heights[size] }, style]}
      >
        {loading
          ? <ActivityIndicator color={Colors.primary} />
          : <View style={styles.inner}>
              {icon ? <Text style={styles.icon}>{icon}</Text> : null}
              <Text style={[styles.secondaryLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
            </View>
        }
      </Touchable>
    );
  }

  if (variant === 'tinted') {
    return (
      <Touchable
        onPress={handlePress}
        disabled={disabled || loading}
        style={[styles.tintedBtn, { height: heights[size] }, style]}
      >
        <View style={styles.inner}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={[styles.tintedLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
        </View>
      </Touchable>
    );
  }

  if (variant === 'danger') {
    return (
      <Touchable
        onPress={handlePress}
        disabled={disabled || loading}
        style={[styles.dangerBtn, { height: heights[size] }, style]}
      >
        <View style={styles.inner}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={[styles.dangerLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
        </View>
      </Touchable>
    );
  }

  return (
    <Touchable onPress={handlePress} disabled={disabled} style={[styles.wrapper, style]}>
      <Text style={[styles.plainLabel, { fontSize: fontSizes[size] }]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
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
    gap: Spacing.xs + 2,
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
    gap: Spacing.xs + 2,
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
    gap: Spacing.xs + 2,
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
    paddingVertical: Spacing.sm + 2,
  },
});
