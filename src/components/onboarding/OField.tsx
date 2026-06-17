// Claude-Design onboarding text field (Act 2): a premium floating-label TextInput with an optional
// "@" prefix + live status indicator (the username check). Tappable picker fields live in the shared
// PickerField. Ref: .ofield / .oflabel in the Onboarding HTML.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TextInputProps } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, interpolateColor, Easing,
} from 'react-native-reanimated';
import { CheckIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { Colors, Typography, Radius } from '@/theme/colors';

export type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

const FOCUS_BG = '#181822';

type Props = {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  prefix?: string;
  status?: FieldStatus;
} & Pick<TextInputProps, 'autoCapitalize' | 'autoComplete' | 'autoCorrect' | 'keyboardType' | 'returnKeyType' | 'onSubmitEditing' | 'maxLength' | 'autoFocus'>;

export default function OField({ label, value, onChangeText, prefix, status = 'idle', ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  const af = useSharedValue(active ? 1 : 0);
  const fc = useSharedValue(0);
  useEffect(() => { af.value = withTiming(active ? 1 : 0, { duration: 180, easing: Easing.out(Easing.quad) }); }, [active]);
  useEffect(() => { fc.value = withTiming(focused ? 1 : 0, { duration: 200 }); }, [focused]);

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(fc.value, [0, 1], [Colors.glassBorder, Colors.accentSolid]),
    backgroundColor: interpolateColor(fc.value, [0, 1], [Colors.backgroundSecondary, FOCUS_BG]),
    shadowOpacity: 0.35 * fc.value,
  }));
  // Crossfade between a centered resting placeholder and a pre-sized floated label. Scaling the label
  // (the prior approach) clipped its leading chars on a fresh mount where it starts floated — e.g.
  // revisiting a filled step. Two pre-laid-out labels at fixed sizes sidestep all transform fragility.
  const restStyle = useAnimatedStyle(() => ({ opacity: 1 - af.value }));
  const floatStyle = useAnimatedStyle(() => ({ opacity: af.value }));
  const floatColor = focused ? Colors.accentSolid : Colors.textTertiary;
  const showPrefix = !!prefix && active;
  const inputLeft = showPrefix ? 32 : 17;
  const inputRight = status !== 'idle' ? 44 : 17;

  return (
    <Animated.View style={[styles.box, styles.wrap, boxStyle]}>
      <Animated.Text style={[styles.labelRest, restStyle]} numberOfLines={1}>{label}</Animated.Text>
      <Animated.Text style={[styles.labelFloat, { color: floatColor }, floatStyle]} numberOfLines={1}>{label}</Animated.Text>
      {showPrefix && <View style={styles.prefixWrap}><Text style={styles.prefix}>{prefix}</Text></View>}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { left: inputLeft, right: inputRight }]}
        selectionColor={Colors.accentSolid}
        {...inputProps}
      />

      {status !== 'idle' && (
        <View style={styles.statusInd}>
          {status === 'checking' && <Spinner />}
          {status === 'available' && <CheckIcon size={18} color={Colors.accentSolid} strokeWidth={2.6} />}
          {status === 'taken' && <XMarkIcon size={16} color={Colors.textSecondary} strokeWidth={2.4} />}
        </View>
      )}
    </Animated.View>
  );
}

function Spinner() {
  const r = useSharedValue(0);
  useEffect(() => { r.value = withRepeat(withTiming(360, { duration: 700, easing: Easing.linear }), -1, false); }, []);
  const s = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return <Animated.View style={[styles.spin, s]} />;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  box: {
    height: 60, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder,
    backgroundColor: Colors.backgroundSecondary, justifyContent: 'center',
    shadowColor: Colors.accentSolid, shadowOpacity: 0, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  // resting placeholder: in-flow, vertically centered by the box's justifyContent
  labelRest: { marginLeft: 17, fontFamily: Typography.fonts.bodyMed, fontSize: 16, letterSpacing: -0.2, color: Colors.textSecondary },
  // floated label: pinned top-left, pre-sized (no scale)
  labelFloat: { position: 'absolute', left: 17, top: 9, fontFamily: Typography.fonts.bodySemi, fontSize: 12, letterSpacing: -0.1 },
  prefixWrap: { position: 'absolute', left: 17, top: 24, bottom: 7, justifyContent: 'center' },
  prefix: { fontFamily: Typography.fonts.bodyMed, fontSize: 16, color: Colors.textSecondary },
  input: { position: 'absolute', top: 24, bottom: 7, fontFamily: Typography.fonts.bodyMed, fontSize: 16, letterSpacing: -0.2, color: Colors.textPrimary, padding: 0 },
  statusInd: { position: 'absolute', right: 13, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  spin: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: Colors.accentSolid },
});
