import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';
import { AnalysisHistoryItem } from '@/types';

const RING = 48;
const STROKE = 4;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

interface Props {
  item: AnalysisHistoryItem;
  delta?: number;       // score vs the previous (chronological) analysis
  loading?: boolean;    // this row is opening
  disabled?: boolean;
  onPress: () => void;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** A single analysis entry — partial-fill band ring + date · verdict + summary + chips.
 *  Shared by the History inline list and the All Analyses screen. */
export default function AnalysisRow({ item, delta, loading, disabled, onPress }: Props) {
  const band = getScoreBand(item.score);
  const [from, to] = scoreGradient(item.score);
  const deltaText = delta != null && delta > 0 ? `+${delta}` : delta != null && delta < 0 ? `${delta}` : '';
  const deltaColor = delta != null && delta > 0 ? Colors.success : Colors.danger;
  const gid = `ar-${item.id}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled} style={[styles.row, loading && { opacity: 0.6 }]}>
      <View style={styles.ring}>
        <Svg width={RING} height={RING}>
          <Defs>
            <SvgGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={from} />
              <Stop offset="100%" stopColor={to} />
            </SvgGradient>
          </Defs>
          <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={Colors.backgroundSecondary} strokeWidth={STROKE} />
          <Circle
            cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={`url(#${gid})`} strokeWidth={STROKE}
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - item.score / 100)} strokeLinecap="round"
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.ringCenter}>
            <Text style={[styles.ringNum, { color: band.color }]}>{item.score}</Text>
          </View>
        </View>
      </View>
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
                <Ionicons name="clipboard-outline" size={12} color={Colors.primary} />
                <Text style={styles.badgeText}>Plan</Text>
              </View>
            )}
            {item.has_captions && (
              <View style={styles.badge}>
                <Ionicons name="images-outline" size={12} color={Colors.primary} />
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
  ring: { width: RING, height: RING },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.callout.fontSize, fontWeight: '700' },
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
    backgroundColor: Colors.primaryContainer, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption2.fontSize, color: Colors.primary },
  chevron: { fontSize: Typography.title2.fontSize, color: Colors.textSecondary, fontWeight: '300' },
});
