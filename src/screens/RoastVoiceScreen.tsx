import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ReAnimated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { CheckCircleIcon } from 'react-native-heroicons/solid';
import { PressableScale } from '@/components/motion';
import { Durations, STAGGER_MS } from '@/theme/motion';
import BottomSheet from '@/components/BottomSheet';
import { TONES } from '@/config/tones';
import { RootStackParamList, RoastTone } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import { updateProfile } from '@/services/profile';

// Hold the cascade until the sheet finishes sliding up, then stagger the cards in — otherwise the
// entrance plays under the slide and the options look like they were always there.
const cardEnter = (i: number) =>
  FadeInDown.delay(Durations.normal + i * STAGGER_MS).duration(Durations.normal).reduceMotion(ReduceMotion.System);

type Props = { route: RouteProp<RootStackParamList, 'RoastVoice'> };

/**
 * Profile → Roast Voice. The app's own voice cards in a bottom sheet — each voice shows its icon +
 * a one-line sample. Tapping persists `preferred_tone` (sticky, same as the composer chips) and
 * dismisses. Reads TONES from @/config/tones (shared with the composer). Presented as a transparent
 * modal route so the sheet animates over Profile.
 */
export default function RoastVoiceScreen({ route }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<RoastTone>(route.params?.current ?? 'savage');

  const pick = (key: RoastTone) => {
    setSelected(key);
    if (user) updateProfile(user.id, { preferred_tone: key }).catch(() => {});
    setOpen(false); // animate the sheet out; onClose returns to Profile (which re-reads the tone on focus)
  };

  return (
    <BottomSheet visible={open} onClose={() => navigation.goBack()}>
      <Text style={styles.intro}>Pick how the app talks to you. Change it anytime — or per roast from the composer.</Text>
      <View style={styles.list}>
        {TONES.map((t, i) => {
          const isSel = t.key === selected;
          return (
            <ReAnimated.View key={t.key} entering={cardEnter(i)}>
              <PressableScale style={[styles.card, isSel && styles.cardActive]} onPress={() => pick(t.key)}>
                <View style={styles.iconWrap}>
                  <t.icon size={30} color={isSel ? Colors.accent : Colors.textPrimary} />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.title, isSel && { color: Colors.accent }]}>{t.label}</Text>
                  <Text style={styles.sample}>“{t.sample}”</Text>
                </View>
                {isSel ? <CheckCircleIcon size={24} color={Colors.accent} /> : <View style={styles.checkSpacer} />}
              </PressableScale>
            </ReAnimated.View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  list: { gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  cardActive: { borderColor: Colors.accent, backgroundColor: Colors.accentContainer },
  iconWrap: { width: 40, alignItems: 'center' }, // no background tile — the bare icon, sized up
  body: { flex: 1, gap: 2 },
  title: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary },
  sample: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  checkSpacer: { width: 24 },
});
