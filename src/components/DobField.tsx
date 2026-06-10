import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDaysIcon } from 'react-native-heroicons/outline';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { latestAdultDob } from '@shared/age';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MIN_DATE = new Date(1920, 0, 1);
const SHEET_TRAVEL = 460; // px the sheet starts below the screen (> its height, so it begins fully hidden)

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

/** Birthday field: a tappable row that opens a **bottom-sheet** date wheel over a dimmed backdrop —
 *  always in view, slides up smoothly. Cancel / tap-outside dismiss without committing; Done commits.
 *  Strict 18+ (the wheel can't scroll younger than 18). Emits a Date; the caller derives what it stores. */
export default function DobField({ value, onChange, defaultDate, placeholder = 'Select your birthday' }: Props) {
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false); // keeps the Modal alive through the close animation
  const [draft, setDraft] = useState<Date>(value ?? defaultDate ?? new Date(2000, 0, 1));
  const anim = useSharedValue(0); // 0 = hidden (off-screen below), 1 = shown

  const open = () => {
    setDraft(value ?? defaultDate ?? new Date(2000, 0, 1));
    setMounted(true);
  };

  // Animate the sheet up once it's mounted.
  useEffect(() => {
    if (!mounted) return;
    anim.value = reduce ? 1 : withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [mounted, reduce]);

  // Slide out, then unmount the Modal (so the exit animation can play).
  const dismiss = (commit: boolean) => {
    if (commit) onChange(draft);
    if (reduce) { setMounted(false); return; }
    anim.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  };

  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => { if (date) setDraft(date); };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: anim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - anim.value) * SHEET_TRAVEL }] }));

  return (
    <View style={styles.container}>
      <PressableScale haptic="light" onPress={open} style={styles.row}>
        <Text style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDob(value) : placeholder}
        </Text>
        <CalendarDaysIcon size={18} color={Colors.textSecondary} />
      </PressableScale>

      <Modal transparent visible={mounted} animationType="none" onRequestClose={() => dismiss(false)}>
        {/* dimmed backdrop = the tap-outside catcher */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(false)}>
          <ReAnimated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        {/* the sheet (taps inside don't dismiss; it sits above the backdrop) */}
        <ReAnimated.View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }, sheetStyle]}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => dismiss(false)} hitSlop={10}><Text style={styles.cancel}>Cancel</Text></Pressable>
            <Text style={styles.sheetTitle}>Birthday</Text>
            <Pressable onPress={() => dismiss(true)} hitSlop={10}><Text style={styles.done}>Done</Text></Pressable>
          </View>
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
        </ReAnimated.View>
      </Modal>
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.groupedBackground,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  sheetTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  cancel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  done: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.accent },
});
