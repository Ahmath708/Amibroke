import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { enterUp, PressableScale, useReducedMotion } from '@/components/motion';
import SectionLabel from '@/components/SectionLabel';
import { ArrowUpOnSquareIcon, ArrowDownTrayIcon, LinkIcon, CheckIcon } from 'react-native-heroicons/outline';
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
import { useAuth } from '@/context/AuthContext';
import { getProfile } from '@/services/profile';
import ScreenBackground from '@/components/ScreenBackground';
import Toast from '@/components/Toast';

type Props = { route: RouteProp<RootStackParamList, 'Share'> };
type CardFormat = 'story' | 'post';

export default function ShareScreen({ route }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { analysis } = route.params;
  const cardRef = useRef<any>(null);
  const [format, setFormat] = useState<CardFormat>('story');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null); // save confirmation (copy uses the inline icon)
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();
  const pop = useSharedValue(1);
  const copyIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
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
      return await captureRef(cardRef, { format: 'png', quality: 1 });
    } catch {
      Alert.alert('Export failed', 'Could not render the card image.');
      return null;
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await capture();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your roast' });
      }
    } catch {
      // user cancelled
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await capture();
      if (!uri) return;
      const { status } = await MediaLibrary.requestPermissionsAsync(true); // add-only
      if (status !== 'granted') {
        Alert.alert('Photos access needed', 'Enable Photos access to save your card.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      setToast('Saved to Photos');
    } catch {
      Alert.alert('Save failed', 'Could not save the card.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(BRAND.domain);
    setCopied(true);
    if (!reduce) pop.value = withSequence(withTiming(1.25, { duration: 130 }), withSpring(1, { damping: 9, stiffness: 180 }));
    setTimeout(() => setCopied(false), 1600);
  };

  const band = getScoreBand(analysis.score);
  const fullRoast = analysis.roast ?? '';
  // Cap by sentence so neither format crops: Story gets up to 3, the shorter Post just the first 2.
  const cardRoast = fullRoast.split(/(?<=[.!?])\s/).slice(0, format === 'story' ? 2 : 1).join(' ');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const ACTIONS = [
    { key: 'share', label: 'Share', Icon: ArrowUpOnSquareIcon, color: Colors.textPrimary, onPress: handleShare },
    { key: 'save', label: 'Save', Icon: ArrowDownTrayIcon, color: Colors.textPrimary, onPress: handleSave },
    { key: 'copy', label: copied ? 'Copied' : 'Copy Link', Icon: copied ? CheckIcon : LinkIcon, color: copied ? Colors.success : Colors.textPrimary, onPress: handleCopy },
  ];

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

        {/* Actions — Share (sheet → post anywhere + save), Save (Photos), Copy Link (inline confirm) */}
        <View style={styles.actionRow}>
          {ACTIONS.map((a) => (
            <PressableScale key={a.key} style={styles.actionBtn} onPress={a.onPress} disabled={busy && a.key !== 'copy'}>
              <ReAnimated.View style={a.key === 'copy' ? copyIconStyle : undefined}>
                <a.Icon size={24} color={a.color} />
              </ReAnimated.View>
              <Text style={[styles.actionLabel, a.key === 'copy' && copied ? { color: Colors.success } : null]}>{a.label}</Text>
            </PressableScale>
          ))}
        </View>
        <Text style={styles.hint}>Share opens the system sheet — post anywhere, or save the image. The roast lives on the card.</Text>
      </ScrollView>
      <Toast message={toast ?? ''} emoji="✅" visible={!!toast} onHide={() => setToast(null)} />
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
  actionBtn: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', gap: Spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight },
  actionLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  hint: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
