// "Not sure? Pick a range" sheet for the Act 2 money steps. Reuses the shared BottomSheet (slide +
// drag-dismiss + scrim) and renders the range rows (canonical brackets) inside. Ref: .sheet / .range-row.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckIcon } from 'react-native-heroicons/outline';
import BottomSheet from '@/components/BottomSheet';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Radius, Spacing } from '@/theme/colors';

export type RangeOption = { label: string; value: string };

export default function RangeSheet({
  visible, title, options, selected, onPick, onClose,
}: {
  visible: boolean;
  title: string;
  options: RangeOption[];
  selected: string | null;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable={false}>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.list}>
        {options.map((opt) => {
          const sel = selected === opt.value;
          return (
            <PressableScale key={opt.value} onPress={() => onPick(opt.value)} style={[styles.row, sel && styles.rowSel]}>
              <Text style={[styles.rowLabel, sel && styles.rowLabelSel]}>{opt.label}</Text>
              {sel && <CheckIcon size={19} color={Colors.accentSolid} strokeWidth={2.6} />}
            </PressableScale>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  h2: { fontFamily: Typography.fonts.heading, fontSize: 22, letterSpacing: -0.6, color: Colors.textPrimary, marginBottom: 16, marginHorizontal: 2 },
  list: { gap: 9 },
  row: {
    height: 56, borderRadius: Radius.lg, backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.glassBorder, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowSel: { borderColor: Colors.accentSolid, backgroundColor: 'rgba(255,0,122,0.12)' },
  rowLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 16, letterSpacing: -0.2, color: Colors.textPrimary },
  rowLabelSel: { color: Colors.accentSolid },
});
