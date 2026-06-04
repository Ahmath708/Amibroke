import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import MiniScoreRing from '@/components/MiniScoreRing';
import { formatShortDate as fmtDate } from '@/utils/format';
import { AnalysisHistoryItem } from '@/types';

interface Props {
  item: AnalysisHistoryItem;
  delta?: number;       // score vs the previous (chronological) analysis
  loading?: boolean;    // this row is opening
  disabled?: boolean;
  onPress: () => void;
}


/** A single analysis entry — partial-fill band ring + date · verdict + summary + chips.
 *  Shared by the History inline list and the All Analyses screen. */
export default function AnalysisRow({ item, delta, loading, disabled, onPress }: Props) {
  const band = getScoreBand(item.score);
  const deltaText = delta != null && delta > 0 ? `+${delta}` : delta != null && delta < 0 ? `${delta}` : '';
  const deltaColor = delta != null && delta > 0 ? Colors.success : Colors.danger;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled} style={[styles.row, loading && { opacity: 0.6 }]}>
      <MiniScoreRing score={item.score} size={48} stroke={4} numberSize={Typography.callout.fontSize} />
      <View style={styles.info}>
        <View style={styles.meta}>
          <Text style={styles.date}>{fmtDate(item.created_at)}</Text>
          <Text style={[styles.verdict, { color: band.color }]} numberOfLines={1}>{band.label}</Text>
          {item.emotional_status?.emoji ? <Text style={styles.emoji}>{item.emotional_status.emoji}</Text> : null}
          {deltaText ? <Text style={[styles.delta, { color: deltaColor }]}>{deltaText}</Text> : null}
        </View>
        <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
        {(item.has_action_plan || item.has_captions) && (
          <View style={styles.badges}>
            {item.has_action_plan && (
              <View style={styles.badge}>
                <Ionicons name="clipboard-outline" size={12} color={Colors.accent} />
                <Text style={styles.badgeText}>Plan</Text>
              </View>
            )}
            {item.has_captions && (
              <View style={styles.badge}>
                <Ionicons name="images-outline" size={12} color={Colors.accent} />
                <Text style={styles.badgeText}>Captions</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <Text style={styles.chevron}>{loading ? '⏳' : '›'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  info: { flex: 1, gap: Spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  date: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  verdict: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, fontWeight: '600', flexShrink: 1 },
  emoji: { fontSize: Typography.subhead.fontSize, marginLeft: 2 },
  delta: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, fontWeight: '600' },
  summary: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18, marginTop: Spacing.xs / 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.accentContainer, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption2.fontSize, color: Colors.accent },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '300' },
});
