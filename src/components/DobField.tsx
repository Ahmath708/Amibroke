import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDaysIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MIN_DATE = new Date(1920, 0, 1);

function formatDob(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

interface Props {
  value: Date | null;
  onChange: (date: Date) => void;
  /** Where the wheel starts when no exact value is set yet (e.g. an age-bracket midpoint). */
  defaultDate?: Date;
  /** Shown when no exact date is set (e.g. an existing coarse bracket, or a prompt). */
  placeholder?: string;
}

/** User-friendly birthday field: a tappable row that reveals the native iOS date wheel, with a
 *  "Done" button to lock it in. Emits a Date; the caller derives whatever it stores (age bracket
 *  today, the real dob once schema-v2 adds the column). */
export default function DobField({ value, onChange, defaultDate, placeholder = 'Select your birthday' }: Props) {
  const [open, setOpen] = useState(false);
  // The wheel edits a draft; nothing commits to the parent until "Done" (iOS) / dialog OK (Android).
  const [draft, setDraft] = useState<Date>(value ?? defaultDate ?? new Date(2000, 0, 1));

  const openPicker = () => {
    setDraft(value ?? defaultDate ?? new Date(2000, 0, 1));
    setOpen(true);
  };
  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false); // Android shows a one-shot dialog with its own OK/Cancel
      if (event.type === 'set' && date) onChange(date);
      return;
    }
    if (date) setDraft(date); // iOS spinner updates the draft live; commit on Done
  };

  return (
    <View>
      <PressableScale haptic="light" onPress={openPicker} style={styles.row}>
        <Text style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDob(value) : placeholder}
        </Text>
        <CalendarDaysIcon size={18} color={Colors.textSecondary} />
      </PressableScale>
      {open && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            maximumDate={new Date()} // can't be born in the future
            minimumDate={MIN_DATE}
            onChange={onPickerChange}
            themeVariant="dark"
            textColor={Colors.textPrimary}
            style={styles.picker}
          />
          {Platform.OS === 'ios' && (
            <PressableScale haptic="light" onPress={confirm} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </PressableScale>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  text: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  placeholder: { color: Colors.textMuted },
  pickerWrap: { marginTop: Spacing.sm },
  picker: {},
  doneBtn: {
    alignSelf: 'flex-end', marginTop: Spacing.xs,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md, backgroundColor: Colors.accentContainer,
  },
  doneText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.accent },
});
