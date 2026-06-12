import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion';
import { Colors, Typography, Spacing } from '@/theme/colors';
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


/** A single analysis entry — band ring + date · verdict + the user's original input (a recognizable
 *  one-liner) + summary. Used by the History screen. */
export default function AnalysisRow({ item, delta, loading, disabled, onPress }: Props) {
  const band = getScoreBand(item.score);
  const deltaText = delta != null && delta > 0 ? `+${delta}` : delta != null && delta < 0 ? `${delta}` : '';
  const deltaColor = delta != null && delta > 0 ? Colors.success : Colors.danger;

  return (
    <PressableScale onPress={onPress} disabled={disabled} style={[styles.row, loading && { opacity: 0.6 }]}>
      <MiniScoreRing score={item.score} size={48} stroke={4} numberSize={Typography.callout.fontSize} />
      <View style={styles.info}>
        <View style={styles.meta}>
          <Text style={styles.date}>{fmtDate(item.created_at)}</Text>
          <Text style={[styles.verdict, { color: band.color }]} numberOfLines={1}>{band.label}</Text>
          {item.emotional_status?.emoji ? <Text style={styles.emoji}>{item.emotional_status.emoji}</Text> : null}
          {deltaText ? <Text style={[styles.delta, { color: deltaColor }]}>{deltaText}</Text> : null}
        </View>
        {item.input_text ? <Text style={styles.inputQuote} numberOfLines={1}>“{item.input_text}”</Text> : null}
        <Text style={styles.summary} numberOfLines={item.input_text ? 1 : 2}>{item.summary}</Text>
      </View>
      <Text style={styles.chevron}>{loading ? '⏳' : '›'}</Text>
    </PressableScale>
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
  inputQuote: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 18, marginTop: Spacing.xs / 2 },
  summary: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18, marginTop: Spacing.xs / 2 },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '300' },
});
