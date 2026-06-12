import React from 'react';
import { View, Text, TextInput, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

/** Strip to digits + a single decimal point, max 2 decimals — applied on every keystroke so the
 *  `.` key (decimal-pad) actually works and can't be entered twice. Allows in-progress values
 *  like "", "0.", ".5", "12.3" without fighting the cursor. */
export function sanitizeDecimal(raw: string): string {
  const s = raw.replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot === -1) return s;
  const intPart = s.slice(0, dot);
  const dec = s.slice(dot + 1).replace(/\./g, '').slice(0, 2); // drop extra dots + cap at 2 decimals
  return `${intPart}.${dec}`;
}

/** Commit formatting (on blur): no decimal typed → keep it whole ("4800" stays "4800"); a decimal
 *  typed → pad to two places ("9.5" → "9.50", ".5" → "0.50", "5." → "5.00"). Strips leading zeros. */
export function formatDecimal(s: string): string {
  if (!s) return '';
  if (!s.includes('.')) return s.replace(/^0+(?=\d)/, '') || '0';
  let [intPart, dec = ''] = s.split('.');
  intPart = intPart.replace(/^0+(?=\d)/, '') || '0';
  dec = (dec + '00').slice(0, 2);
  return `${intPart}.${dec}`;
}

export interface DecimalFieldProps {
  value: string;
  onChangeValue: (v: string) => void;
  onBlur?: () => void; // fired after the on-blur format-tidy, so a parent can react (e.g. sync a bracket)
  placeholder?: string;
  autoFocus?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

interface Props extends DecimalFieldProps {
  prefix?: string;
  suffix?: string;
}

/** Numeric input that lets you type a single decimal point (max 2 places) on the decimal-pad
 *  keyboard, tidying on blur (keep-whole-unless-cents). Base for MoneyInput ($) and PercentInput (%). */
export default function DecimalInput({ value, onChangeValue, onBlur, prefix, suffix, placeholder, autoFocus, containerStyle }: Props) {
  return (
    <View style={[styles.row, containerStyle]}>
      {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={(t) => onChangeValue(sanitizeDecimal(t))}
        onBlur={() => { onChangeValue(formatDecimal(value)); onBlur?.(); }}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoFocus={autoFocus}
        selectionColor={Colors.accent}
        style={styles.input}
      />
      {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', // never collapse in flex-start/centered parents
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    paddingHorizontal: Spacing.md,
  },
  affix: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, color: Colors.textSecondary },
  input: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm },
});
