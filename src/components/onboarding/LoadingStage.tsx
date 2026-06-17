// Act 3 loading — the score gauge HUNTS toward random targets (the meter "calculating", never
// settling) while on-voice copy cycles. The parent flips to the reveal once the real score resolves.
// Ref: LoadingScreen in the Onboarding HTML.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue, useReducedMotion } from 'react-native-reanimated';
import { Colors, Typography, Spacing } from '@/theme/colors';
import ScoreGauge from './ScoreGauge';

export default function LoadingStage({ messages }: { messages: string[] }) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(0.38);
  const comet = useSharedValue(1);
  const [ci, setCi] = useState(0);

  // The meter HUNTS: a value that continuously chases a target which jumps every ~450ms — fast enough
  // that the center number visibly scrambles (active "calculating", not a smooth searching sweep).
  useEffect(() => {
    if (reduce) { progress.value = 0.6; return; }
    let target = 0.74;
    const retarget = setInterval(() => { target = Math.random(); }, 450);
    const tick = setInterval(() => { progress.value += (target - progress.value) * 0.28; }, 33);
    return () => { clearInterval(retarget); clearInterval(tick); };
  }, [reduce]);

  useEffect(() => {
    const t = setInterval(() => setCi((c) => (c + 1) % messages.length), 1700);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Your starting score</Text>
      <ScoreGauge progress={progress} cometOpacity={comet} pad />
      <Text style={styles.copy}>{messages[ci]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  eyebrow: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, color: Colors.textSecondary, letterSpacing: 0.3 },
  copy: { fontFamily: Typography.fonts.bodySemi, fontSize: 16, color: Colors.textSecondary, letterSpacing: -0.2, textAlign: 'center', maxWidth: 300, lineHeight: 22 },
});
