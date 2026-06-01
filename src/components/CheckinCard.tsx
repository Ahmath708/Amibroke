import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  onPress: () => void;
  style?: ViewStyle;
}

/** Home nudge for the monthly check-in. Shows only for users who track goals:
 *  a prominent CTA when due, a compact "next check-in" line otherwise. */
export default function CheckinCard({ onPress, style }: Props) {
  const { loading, configured, due, dueDate } = useCheckinStatus();
  if (loading || !configured) return null;

  const dateLabel = dueDate ? `${MONTHS_SHORT[dueDate.getMonth()]} ${dueDate.getDate()}` : '';

  if (due) {
    const monthName = dueDate ? MONTHS_FULL[dueDate.getMonth()] : 'your';
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={style}>
        <LinearGradient
          colors={['rgba(0,224,255,0.22)', 'rgba(189,0,255,0.18)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.dueCard}
        >
          <Text style={styles.dueEmoji}>📅</Text>
          <View style={styles.dueText}>
            <Text style={styles.dueTitle}>Your {monthName} check-in is ready</Text>
            <Text style={styles.dueBody}>Update your numbers and see your progress.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
      <View style={styles.compact}>
        <Text style={styles.compactIcon}>✅</Text>
        <Text style={styles.compactText}>Tracking monthly{dateLabel ? ` · Next check-in ${dateLabel}` : ''}</Text>
        <Text style={styles.chevronMuted}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dueCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  dueEmoji: { fontSize: 26 },
  dueText: { flex: 1 },
  dueTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, marginBottom: 2 },
  dueBody: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.tint, fontWeight: '300' },
  compact: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.groupedRow,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  compactIcon: { fontSize: Typography.subhead.fontSize },
  compactText: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  chevronMuted: { fontSize: Typography.headline.fontSize, color: Colors.textMuted, fontWeight: '300' },
});
