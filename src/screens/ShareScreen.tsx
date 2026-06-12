import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp, PressableScale } from '@/components/motion';
import SectionLabel from '@/components/SectionLabel';
import { ArrowUpOnSquareIcon, ArrowDownTrayIcon, LinkIcon } from 'react-native-heroicons/outline';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation } from '@react-navigation/native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { BRAND } from '@/config/brand';
import { getScoreBand } from '@shared/scoring/bands.ts';
import BrokeCard from '@/components/BrokeCard';
import ShareActionButton from '@/components/ShareActionButton';
import { useAuth } from '@/context/AuthContext';
import { getProfile } from '@/services/profile';
import ScreenBackground from '@/components/ScreenBackground';

type Props = { route: RouteProp<RootStackParamList, 'Share'> };
type CardFormat = 'story' | 'post';

export default function ShareScreen({ route }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { analysis } = route.params;
  const cardRef = useRef<any>(null);
  const [format, setFormat] = useState<CardFormat>('story');
  const { user } = useAuth();
  const [handle, setHandle] = useState('');
  useEffect(() => {
    if (user) getProfile(user.id).then((p) => { if (p?.username) setHandle('@' + p.username); }).catch(() => {});
  }, [user]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Share Result',
      headerTitleStyle: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.headline.fontSize, color: Colors.textPrimary },
      headerStyle: { backgroundColor: Colors.background },
    });
  }, [navigation]);

  // Capture the card as a PNG (the roast lives ON the card, so the image is self-contained).
  const capture = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      // captureRef returns a bare /var path on iOS; expo-sharing + media-library need a file:// URI.
      const raw = await captureRef(cardRef, { format: 'png', quality: 1 });
      return raw.startsWith('file://') || raw.startsWith('ph://') ? raw : `file://${raw}`;
    } catch {
      Alert.alert('Export failed', 'Could not render the card image.');
      return null;
    }
  };

  // Share → OS sheet. No success state: shareAsync resolves on dismissal whether posted or cancelled
  // (iOS can't tell us which), so a "Shared!" confirm would lie — the sheet itself is the feedback.
  const handleShare = async (): Promise<void> => {
    const uri = await capture();
    if (uri && (await Sharing.isAvailableAsync())) {
      try {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your roast' });
      } catch {
        // user dismissed the sheet
      }
    }
  };

  // Save → Photos. Returns true only on a real save, so the tile morphs to "Saved" only then.
  const handleSave = async (): Promise<boolean> => {
    const uri = await capture();
    if (!uri) return false;
    const perm = await MediaLibrary.requestPermissionsAsync(true); // add-only
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Enable Photos access to save your card.');
      return false;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      return true;
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message ?? e));
      return false;
    }
  };

  const handleCopy = async (): Promise<boolean> => {
    await Clipboard.setStringAsync(BRAND.domain);
    return true;
  };

  const band = getScoreBand(analysis.score);
  const fullRoast = analysis.roast ?? '';
  // Cap by sentence so neither format crops: Story gets up to 2, the shorter Post just the first 1.
  const cardRoast = fullRoast.split(/(?<=[.!?])\s/).slice(0, format === 'story' ? 2 : 1).join(' ');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="share" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Format toggle — destination-based (both portrait, both carry the roast) */}
        <View style={styles.formatRow}>
          <SectionLabel>Format</SectionLabel>
          <View style={styles.formatToggle}>
            {(['story', 'post'] as CardFormat[]).map((f) => (
              <PressableScale key={f} style={[styles.formatBtn, format === f && styles.formatBtnActive]} onPress={() => setFormat(f)}>
                <Text style={[styles.formatBtnText, format === f && styles.formatBtnTextActive]}>{f === 'story' ? 'Story 9:16' : 'Post 4:5'}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* Shareable card */}
        <SectionLabel>Your Share Card</SectionLabel>
        <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
          <View style={[styles.exportFrame, format === 'story' ? styles.frameStory : styles.framePost]}>
            <LinearGradient colors={['#1a0026', '#0d001a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <BrokeCard name={handle} score={analysis.score} bandLabel={band.label} bandColor={band.color} dateStr={dateStr} animated={false} />
            {cardRoast ? (
              <View style={styles.roastBlock}>
                <Text style={styles.roastQuote} numberOfLines={format === 'story' ? 5 : 3}>“{cardRoast}”</Text>
                {analysis.emotionalStatus?.label ? (
                  <Text style={styles.roastMood}>{analysis.emotionalStatus.emoji} {analysis.emotionalStatus.label}</Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.frameFooter}>{BRAND.domain}</Text>
          </View>
        </ViewShot>

        {/* Actions — Share (OS sheet, no confirm), Save + Copy confirm inline via the shared tile */}
        <View style={styles.actionRow}>
          <ShareActionButton icon={ArrowUpOnSquareIcon} label="Share" onPress={handleShare} />
          <ShareActionButton icon={ArrowDownTrayIcon} label="Save" successLabel="Saved" onPress={handleSave} />
          <ShareActionButton icon={LinkIcon} label="Copy Link" successLabel="Copied" onPress={handleCopy} />
        </View>
        <Text style={styles.hint}>Share opens the system sheet — post anywhere, or save the image. The roast lives on the card.</Text>
      </ScrollView>
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  formatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  formatToggle: { flexDirection: 'row', backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, padding: 2 },
  formatBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm },
  formatBtnActive: { backgroundColor: Colors.accentContainer },
  formatBtnText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  formatBtnTextActive: { color: Colors.accent, fontFamily: Typography.fonts.bodyMed },
  // Tighter padding so the card never overflows the (shorter) Post frame and clips on top.
  exportFrame: { borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, overflow: 'hidden', justifyContent: 'center', alignItems: 'stretch', gap: Spacing.lg },
  frameStory: { aspectRatio: 9 / 16, width: '100%' },
  framePost: { aspectRatio: 4 / 5, width: '100%' },
  frameFooter: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textAlign: 'center' },
  roastBlock: { gap: Spacing.sm, paddingHorizontal: Spacing.xs },
  roastQuote: { fontFamily: Typography.fonts.body, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 28, textAlign: 'center' },
  roastMood: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.accent, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  hint: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
