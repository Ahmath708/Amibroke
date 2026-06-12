import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDaysIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import BottomSheet from '@/components/BottomSheet';
import NeonButton from '@/components/NeonButton';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { latestAdultDob } from '@shared/age';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MIN_DATE = new Date(1920, 0, 1);

function formatDob(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function sameYmd(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface Props {
  value: Date | null;
  onChange: (date: Date) => void;
  /** Where the wheel starts when no exact value is set yet (e.g. an age-bracket midpoint). */
  defaultDate?: Date;
  /** Shown when no exact date is set (e.g. an existing coarse bracket, or a prompt). */
  placeholder?: string;
}

/** Birthday field: a tappable row that opens the date wheel in a bottom sheet. Tap-outside / swipe
 *  dismiss without committing; "Set birthday" commits. Strict 18+ (the wheel can't scroll younger
 *  than 18). Emits a Date; the caller derives what it stores. */
export default function DobField({ value, onChange, defaultDate, placeholder = 'Select your birthday' }: Props) {
  const seed = () => value ?? defaultDate ?? new Date(2000, 0, 1);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(seed);
  const [baseline, setBaseline] = useState<Date>(seed); // the date the sheet opened on — drives "changed"

  const openSheet = () => {
    const s = seed();
    setDraft(s);
    setBaseline(s);
    setOpen(true);
  };
  const commit = () => { onChange(draft); setOpen(false); };
  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => { if (date) setDraft(date); };
  const changed = !sameYmd(draft, baseline); // disabled until the wheel actually moves off where it opened

  return (
    <View style={styles.container}>
      <PressableScale haptic="light" onPress={openSheet} style={styles.row}>
        <Text style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDob(value) : placeholder}
        </Text>
        <CalendarDaysIcon size={18} color={Colors.textSecondary} />
      </PressableScale>

      <BottomSheet visible={open} onClose={() => setOpen(false)} scrollable={false} dragHandleOnly>
        <DateTimePicker
          value={draft}
          mode="date"
          display="spinner"
          maximumDate={latestAdultDob()} // strict 18+: can't even scroll younger than 18
          minimumDate={MIN_DATE}
          onChange={onPickerChange}
          themeVariant="dark"
          textColor={Colors.textPrimary}
        />
        <NeonButton label="Update Birthday" onPress={commit} disabled={!changed} style={styles.cta} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  text: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  placeholder: { color: Colors.textMuted },
  cta: { marginTop: Spacing.sm },
});
