// Act 3 reveal — the gauge settles on the real score (decelerating count-up, comet dissolves on
// lock) with a haptic landing (no particle burst), then band → reaction → snapshot → note → CTA
// cascade in. "Share my score" captures the BrokeCard as an image. Ref: RevealScreen in the HTML.
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ReAnimated, { useSharedValue, withTiming, runOnJS, useReducedMotion, Easing } from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { ArrowUpTrayIcon } from 'react-native-heroicons/outline';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { enterUp, PressableScale } from '@/components/motion';
import { impact, ImpactFeedbackStyle } from '@/utils/haptics';
import { getScoreBand } from '@shared/scoring/bands.ts';
import NeonButton from '@/components/NeonButton';
import BrokeCard from '@/components/BrokeCard';
import { useShare } from '@/hooks/useShare';
import ScoreGauge from './ScoreGauge';

export type SnapCell = { label: string; value: string };

function glowFor(label: string): number {
  return label === 'Cooked' ? 0.4 : label === 'Surviving' ? 0.32 : label === 'Stable' ? 0.26 : 0.22;
}

export default function RevealStage({
  score, reaction, name, dateStr, snapshot, onSeeRoast,
}: {
  score: number;
  reaction: string;
  name: string;
  dateStr: string;
  snapshot: SnapCell[];
  onSeeRoast: () => void;
}) {
  const reduce = useReducedMotion();
  const band = getScoreBand(score);
  const progress = useSharedValue(0);
  const comet = useSharedValue(1);
  const [locked, setLocked] = useState(false);
  const cardRef = useRef<ViewShot>(null);
  const { shareFile, sharing } = useShare();

  const onLocked = () => { setLocked(true); impact(ImpactFeedbackStyle.Heavy); };

  useEffect(() => {
    if (reduce) { progress.value = score / 100; comet.value = 0; onLocked(); return; }
    progress.value = withTiming(score / 100, { duration: 1500, easing: Easing.out(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished) {
        comet.value = withTiming(0, { duration: 550 });
        runOnJS(onLocked)();
      }
    });
  }, []);

  const shareCard = async () => {
    if (sharing) return;
    try {
      const raw = await captureRef(cardRef, { format: 'png', quality: 1 });
      await shareFile(raw.startsWith('file://') ? raw : `file://${raw}`, 'image/png');
    } catch (e) {
      console.warn('[onboarding] share card failed:', e);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>Your starting score</Text>
      <ScoreGauge progress={progress} cometOpacity={comet} color={band.color} glowColor={band.color} glowOpacity={glowFor(band.label)} />

      {locked && (
        <>
          <ReAnimated.Text entering={enterUp(0)} style={[styles.band, { color: band.color }]}>{band.label}</ReAnimated.Text>
          <ReAnimated.Text entering={enterUp(1)} style={styles.reaction}>{reaction}</ReAnimated.Text>

          <ReAnimated.View entering={enterUp(2)} style={styles.snapshot}>
            {snapshot.map((s) => (
              <View key={s.label} style={styles.cell}>
                <Text style={styles.cellLabel}>{s.label}</Text>
                <Text style={styles.cellVal} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              </View>
            ))}
          </ReAnimated.View>

          <ReAnimated.Text entering={enterUp(3)} style={styles.note}>
            Your starting estimate — built from the basics. Your first real roast sharpens it.
          </ReAnimated.Text>

          <ReAnimated.View entering={enterUp(4)} style={styles.actions}>
            <NeonButton label="See the real roast →" onPress={onSeeRoast} />
            <PressableScale onPress={shareCard} style={styles.shareBtn} disabled={sharing}>
              <ArrowUpTrayIcon size={16} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.shareText}>Share my score</Text>
            </PressableScale>
          </ReAnimated.View>
        </>
      )}

      {/* off-screen card captured by "Share my score" */}
      <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }} style={styles.hiddenCard}>
        <BrokeCard name={name} score={score} bandLabel={band.label} bandColor={band.color} dateStr={dateStr} animated={false} />
      </ViewShot>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  eyebrow: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, color: Colors.textSecondary, letterSpacing: 0.3, marginBottom: Spacing.md },
  band: { fontFamily: Typography.fonts.extrabold, fontSize: 25, letterSpacing: -0.6, textAlign: 'center', marginTop: 22 },
  reaction: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  snapshot: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 28 },
  cell: { flex: 1, backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, paddingVertical: 13, paddingHorizontal: 8, alignItems: 'center' },
  cellLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.3 },
  cellVal: { fontFamily: Typography.fonts.monoSemi, fontSize: 17, letterSpacing: -0.6, color: Colors.textPrimary, marginTop: 8 },
  note: { fontFamily: Typography.fonts.body, fontSize: 12.5, lineHeight: 18, color: Colors.textTertiary, textAlign: 'center', maxWidth: 300, marginTop: 18 },
  actions: { alignSelf: 'stretch', marginTop: 22 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: Spacing.md, marginTop: Spacing.xs },
  shareText: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.textSecondary, letterSpacing: -0.2 },
  hiddenCard: { position: 'absolute', left: -10000, top: 0 },
});
