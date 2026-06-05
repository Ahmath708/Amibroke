import React from 'react';
import { Text, View, StyleSheet, ViewStyle } from 'react-native';
import { ChevronRightIcon, CalendarIcon } from 'react-native-heroicons/outline';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  onPress: () => void;
  style?: ViewStyle;
}

/** Home nudge for the monthly check-in. Shows only for users who track goals:
 *  a prominent CTA when due, a compact "next check-in" line otherwise.
 *  Neutral elevated surface (the accent moment is reserved for the premium card),
 *  with an accent-tinted icon badge + chevron for a contained pop. */
export default function CheckinCard({ onPress, style }: Props) {
  const { loading, configured, due, dueDate, streak } = useCheckinStatus();
  if (loading || !configured) return null;

  const dateLabel = dueDate ? `${MONTHS_SHORT[dueDate.getMonth()]} ${dueDate.getDate()}` : '';

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
          <ChevronRightIcon size={18} color={Colors.accent} />
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={onPress} haptic="light" style={style}>
      <View style={styles.compact}>
        <Text style={styles.compactIcon}>{streak > 1 ? '🔥' : '✅'}</Text>
        <Text style={styles.compactText}>{streak > 1 ? `${streak}-month streak` : 'Tracking monthly'}{dateLabel ? ` · Next ${dateLabel}` : ''}</Text>
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
