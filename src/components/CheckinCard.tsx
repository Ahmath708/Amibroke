import React from 'react';
import { Text, View, StyleSheet, ViewStyle } from 'react-native';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { dueStatus } from '@/utils/checkinSchedule';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  onPress: () => void;
  /** Earliest roast date — used as the schedule anchor when the user hasn't set up goals yet,
   *  so the card still persists and states the next check-in for any roasted user. */
  anchorFallback?: string | null;
  style?: ViewStyle;
}

/** Home nudge for the monthly check-in. Persists for any user with a check-in schedule as a calm
 *  one-liner — "your {month} check-in is ready" (brighter text + accent chevron) when due, a muted
 *  "next check-in · date" otherwise. Kept compact so the Dashboard hierarchy (score + finances)
 *  leads; the accent moment stays reserved for the premium card. */
export default function CheckinCard({ onPress, anchorFallback, style }: Props) {
  const { loading, config, lastCheckIn, streak } = useCheckinStatus();
  if (loading) return null;

  // Anchor on the user's set-up date, else the earliest roast — so the schedule (and the next
  // date) exist even before they pin goals. No anchor at all → nothing to state.
  const anchor = config.firstAnalyzeAt ?? anchorFallback ?? null;
  const status = dueStatus(anchor ? new Date(anchor) : null, lastCheckIn ? new Date(lastCheckIn.created_at) : null, new Date());
  if (!status) return null;
  const { due, dueDate } = status;

  const dateLabel = `${MONTHS_SHORT[dueDate.getMonth()]} ${dueDate.getDate()}`;

  // One calm one-liner either way, so the Dashboard hierarchy (score + finances) leads. Due → an
  // actionable "ready" line (brighter text + accent chevron); otherwise the next-check-in date.
  const monthFull = MONTHS_FULL[dueDate.getMonth()];
  const icon = streak > 1 ? '🔥' : due ? '🔔' : '🗓️';
  const text = due
    ? `Your ${monthFull} check-in is ready`
    : `Next check-in · ${dateLabel}${streak > 1 ? ` · ${streak}-mo streak` : ''}`;

  return (
    <PressableScale onPress={onPress} haptic="light" style={style}>
      <View style={styles.compact}>
        <Text style={styles.compactIcon}>{icon}</Text>
        <Text style={[styles.compactText, due && styles.compactTextDue]} numberOfLines={1}>{text}</Text>
        <ChevronRightIcon size={16} color={due ? Colors.accent : Colors.textMuted} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  compactIcon: { fontSize: Typography.subhead.fontSize },
  compactText: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  compactTextDue: { color: Colors.textPrimary },
});
