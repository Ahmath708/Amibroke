import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, Typography, Spacing } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { scoreGradient } from '@/utils/scoreVisual';
import { AnalysisHistoryItem } from '@/types';
import {
  getAnalysisHistory, getAnalysisById, getMySharedAnalysisIds, shareToFeed, unshareFromFeed,
} from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import NeonButton from '@/components/NeonButton';

const RING = 40;
const STROKE = 3.5;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

interface Props {
  visible: boolean;
  onClose: () => void;
  onRunAnalysis: () => void;
}

/**
 * Lets the user manage which of their analyses are shared (anonymously) to the
 * community feed. Each row toggles post/unpost optimistically; unsharing confirms
 * first because it deletes the post + its reactions.
 */
export default function ShareManagerSheet({ visible, onClose, onRunAnalysis }: Props) {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisHistoryItem[]>([]);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !user) return;
    let active = true;
    setLoading(true);
    Promise.all([getAnalysisHistory(user.id), getMySharedAnalysisIds(user.id)])
      .then(([list, shared]) => {
        if (!active) return;
        setAnalyses(list);
        setSharedIds(new Set(shared));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, user]);

  const persistToggle = async (item: AnalysisHistoryItem, share: boolean) => {
    if (!user) return;
    const id = item.id;
    setPending((p) => new Set(p).add(id));
    setSharedIds((prev) => { const n = new Set(prev); share ? n.add(id) : n.delete(id); return n; }); // optimistic
    const revert = () => setSharedIds((prev) => { const n = new Set(prev); share ? n.delete(id) : n.add(id); return n; });
    try {
      if (share) {
        const a = await getAnalysisById(id);
        if (!a?.roast) { revert(); return; }
        const postId = await shareToFeed(user.id, id, a.score, a.scoreLabel, a.roast, a.summary);
        if (!postId) revert();
      } else {
        const ok = await unshareFromFeed(id, user.id);
        if (!ok) revert();
      }
    } catch {
      revert();
    } finally {
      setPending((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const onToggle = (item: AnalysisHistoryItem, next: boolean) => {
    if (pending.has(item.id)) return;
    if (next) {
      persistToggle(item, true);
    } else {
      Alert.alert(
        'Remove from community?',
        'Your post and its reactions will be deleted. You can re-share anytime — reactions start over.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => persistToggle(item, false) },
        ],
      );
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Share to Community</Text>
          <TouchableOpacity onPress={onClose} hitSlop={HIT}>
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Pick which roasts appear anonymously in the feed. Toggle one off to remove it.
        </Text>

        {loading ? (
          <LoadingState style={{ paddingTop: 60 }} />
        ) : analyses.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState emoji="📊" title="No analyses yet" body="Run your first analysis, then come back to share it." />
            <NeonButton label="Run an Analysis" onPress={onRunAnalysis} style={{ marginTop: Spacing.lg }} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {analyses.map((item) => {
              const band = getScoreBand(item.score);
              const [from, to] = scoreGradient(item.score);
              const shared = sharedIds.has(item.id);
              return (
                <View key={item.id} style={styles.row}>
                  <View style={styles.ring}>
                    <Svg width={RING} height={RING}>
                      <Defs>
                        <SvgGradient id={`mgr-${item.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor={from} />
                          <Stop offset="100%" stopColor={to} />
                        </SvgGradient>
                      </Defs>
                      <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={Colors.backgroundSecondary} strokeWidth={STROKE} />
                      <Circle
                        cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={`url(#mgr-${item.id})`} strokeWidth={STROKE}
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
                    <Text style={styles.date} numberOfLines={1}>
                      {fmtDate(item.created_at)} · <Text style={{ color: band.color }}>{band.label}</Text>
                    </Text>
                    <Text style={styles.snippet} numberOfLines={2}>{item.summary}</Text>
                  </View>
                  <Switch
                    value={shared}
                    onValueChange={(v) => onToggle(item, v)}
                    disabled={pending.has(item.id)}
                    trackColor={{ true: Colors.primarySolid, false: Colors.backgroundSecondary }}
                    thumbColor="#fff"
                    ios_backgroundColor={Colors.backgroundSecondary}
                  />
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.textPrimary },
  done: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.primary, fontWeight: '600' },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  empty: { flex: 1, alignItems: 'center', paddingTop: 40 },
  scroll: { paddingBottom: Spacing.xxl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  ring: { width: RING, height: RING },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: Typography.fonts.heading, fontSize: Typography.footnote.fontSize, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  date: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textPrimary },
  snippet: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, lineHeight: 16 },
});
