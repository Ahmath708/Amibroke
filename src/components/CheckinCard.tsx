import React from 'react';
import { Text, View, StyleSheet, ViewStyle } from 'react-native';
import { ChevronRightIcon, CalendarIcon } from 'react-native-heroicons/outline';
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

/** Home nudge for the monthly check-in. Persists for any user with a check-in schedule: a
 *  prominent CTA when due, a compact "next check-in · date" line otherwise. Neutral elevated
 *  surface (the accent moment is reserved for the premium card), with an accent-tinted icon
 *  badge + chevron for a contained pop. */
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

  if (due) {
    const monthName = dueDate ? MONTHS_FULL[dueDate.getMonth()] : 'your';
    return (
      <PressableScale onPress={onPress} haptic="light" style={style}>
        <View style={styles.dueCard}>
          <View style={styles.iconBadge}><CalendarIcon size={20} color={Colors.accent} /></View>
          <View style={styles.dueText}>
            <Text style={styles.dueTitle}>Your {monthName} check-in is ready</Text>
            <Text style={styles.dueBody}>{streak > 1 ? `Keep your ${streak}-month streak alive 🔥` : 'Check in on how you’re feeling + what’s changed.'}</Text>
          </View>
          <ChevronRightIcon size={18} color={Colors.textSecondary} />
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={onPress} haptic="light" style={style}>
      <View style={styles.compact}>
        <Text style={styles.compactIcon}>{streak > 1 ? '🔥' : '🗓️'}</Text>
        <Text style={styles.compactText}>Next check-in · {dateLabel}{streak > 1 ? ` · ${streak}-mo streak` : ''}</Text>
        <ChevronRightIcon size={16} color={Colors.textMuted} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  dueCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  iconBadge: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.accentContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  dueText: { flex: 1 },
  dueTitle: { fontFamily: Typography.fonts.heading, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.2, marginBottom: 2 },
  dueBody: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  compact: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  compactIcon: { fontSize: Typography.subhead.fontSize },
  compactText: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
});
