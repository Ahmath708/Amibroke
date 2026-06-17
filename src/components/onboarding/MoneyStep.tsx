// Act 2 money entry (Income / Money out / Debt / Cushion). A giant $ display, a numeric keypad, and a
// "Not sure? Pick a range" fallback sheet — either a typed exact OR a chosen range. Ref: MoneyScreen
// + .keypad + RangeFallback in the Onboarding HTML.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { BackspaceIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Radius, Spacing } from '@/theme/colors';
import FormDock from './FormDock';
import RangeSheet, { RangeOption } from './RangeSheet';

export type MoneyValue = { exact: string; range: string | null };

const NONE = 'none';

function format(raw: string): string {
  if (raw === '') return '$0';
  let [intp, dec] = raw.split('.');
  intp = intp.replace(/^0+(?=\d)/, '');
  if (intp === '') intp = '0';
  const grouped = Number(intp).toLocaleString('en-US');
  return '$' + grouped + (raw.indexOf('.') !== -1 ? '.' + (dec || '') : '');
}

const KEY_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'back']];

export default function MoneyStep({
  headline, sub, sheetTitle, options, value, onChange, onBack, onNext,
}: {
  headline: string;
  sub: string;
  sheetTitle: string;
  options: RangeOption[];
  value: MoneyValue;
  onChange: (v: MoneyValue) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [sheet, setSheet] = useState(false);

  const press = (k: string) => {
    let cur = value.range !== null ? '' : value.exact; // keypad wins the display back from a range
    if (k === 'back') cur = cur.slice(0, -1);
    else if (k === '.') { if (cur.indexOf('.') === -1) cur = cur === '' ? '0.' : cur + '.'; }
    else {
      const dot = cur.indexOf('.');
      if (dot !== -1 && cur.length - dot > 2) { /* max 2 decimals */ }
      else if (cur === '0') cur = k;
      else if (cur.replace('.', '').length >= 12) { /* sane cap */ }
      else cur = cur + k;
    }
    onChange({ exact: cur, range: null });
  };

  const pickRange = (v: string) => {
    if (v === NONE) onChange({ exact: '0', range: null }); // "None" reads as a typed $0
    else onChange({ exact: '', range: v });
    setSheet(false);
  };

  const typed = value.exact !== '' && value.exact !== '.';
  const hasValue = typed || value.range !== null;
  const rangeLabel = value.range ? options.find((o) => o.value === value.range)?.label ?? '' : '';
  const displayText = value.range ? rangeLabel : format(value.exact);
  const isPlaceholder = value.range === null && value.exact === '';

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.h1}>{headline}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>

      <View style={styles.display}>
        <Text style={[styles.amount, isPlaceholder && styles.amountPh]} numberOfLines={1} adjustsFontSizeToFit>
          {displayText}
        </Text>
        {typed && <Caret />}
      </View>

      <PressableScale onPress={() => setSheet(true)} style={styles.notSure}>
        <Text style={styles.notSureText}>Not sure? Pick a range</Text>
        <ChevronRightIcon size={15} color={Colors.textTertiary} strokeWidth={2.2} />
      </PressableScale>

      <View style={styles.keypad}>
        {KEY_ROWS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k) => (
              <PressableScale key={k} onPress={() => press(k)} style={[styles.key, k === 'back' && styles.keyFn]}>
                {k === 'back' ? <BackspaceIcon size={24} color={Colors.textSecondary} /> : <Text style={styles.keyText}>{k}</Text>}
              </PressableScale>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.dock}>
        <FormDock onBack={onBack} onNext={onNext} canNext={hasValue} />
      </View>

      <RangeSheet visible={sheet} title={sheetTitle} options={options} selected={value.range} onPick={pickRange} onClose={() => setSheet(false)} />
    </View>
  );
}

function Caret() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 530 }), withTiming(0, { duration: 530 })), -1, false);
  }, []);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.caret, s]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingTop: Spacing.xl },
  h1: { fontFamily: Typography.fonts.extrabold, fontSize: 38, letterSpacing: -1.6, lineHeight: 38, color: Colors.textPrimary },
  sub: { fontFamily: Typography.fonts.body, fontSize: 15, lineHeight: 22.5, color: Colors.textSecondary, marginTop: 14 },
  display: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 0 },
  amount: { fontFamily: Typography.fonts.heading, fontSize: 60, letterSpacing: -2.5, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  amountPh: { color: 'rgba(255,255,255,0.22)' },
  caret: { width: 3, height: 52, borderRadius: 2, backgroundColor: Colors.accentSolid, marginLeft: 5 },
  notSure: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, marginBottom: 14 },
  notSureText: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textSecondary, letterSpacing: -0.1 },
  keypad: { gap: 10 },
  keyRow: { flexDirection: 'row', gap: 10 },
  key: {
    flex: 1, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  keyFn: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontFamily: Typography.fonts.headingMed, fontSize: 25, letterSpacing: -0.5, color: Colors.textPrimary },
  dock: { paddingTop: 14 },
});
