import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import BottomSheet from '@/components/BottomSheet';
import NeonButton from '@/components/NeonButton';
import PickerField from '@/components/PickerField';
import { Colors, Typography, Spacing } from '@/theme/colors';
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
  /** Floating field label (default "Birthday"). */
  label?: string;
}

/** Birthday field: a tappable Claude-Design field that opens the date wheel in a bottom sheet.
 *  Tap-outside / swipe dismiss without committing; "Set birthday" commits. Strict 18+ (the wheel
 *  can't scroll younger than 18). Emits a Date; the caller derives what it stores. */
export default function DobField({ value, onChange, defaultDate, placeholder = 'Select your birthday', label = 'Birthday' }: Props) {
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
  // A fresh set (no birthday yet) can confirm the wheel as-is — even at the default seed; only an
  // EDIT of an existing value is gated to an actual change (so "Set birthday" never opens disabled).
  const canCommit = value == null || !sameYmd(draft, baseline);

  return (
    <>
      <PickerField label={label} value={value ? formatDob(value) : undefined} placeholder={placeholder} onPress={openSheet} active={open} />

      <BottomSheet visible={open} onClose={() => setOpen(false)} scrollable={false} dragHandleOnly>
        <Text style={styles.heading}>When’s your birthday?</Text>
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
        <NeonButton label="Set birthday" onPress={commit} disabled={!canCommit} style={styles.cta} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: Typography.fonts.heading, fontSize: 22, letterSpacing: -0.6, color: Colors.textPrimary, marginBottom: Spacing.xs, marginHorizontal: 2 },
  cta: { marginTop: Spacing.sm },
});
