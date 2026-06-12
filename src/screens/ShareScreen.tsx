import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Share, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp, PressableScale } from '@/components/motion';
import SectionLabel from '@/components/SectionLabel';
import NeonButton from '@/components/NeonButton';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinkIcon } from 'react-native-heroicons/outline';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation } from '@react-navigation/native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { BRAND } from '@/config/brand';
import { getScoreBand } from '@shared/scoring/bands.ts';
import BrokeCard from '@/components/BrokeCard';
import { useAuth } from '@/context/AuthContext';
import { getProfile } from '@/services/profile';
import ScreenBackground from '@/components/ScreenBackground';
import { fetchOrGenerateCaptions } from '@/services/ai';
import type { CaptionResponse } from '@shared/types';

type Props = { route: RouteProp<RootStackParamList, 'Share'> };

type CardFormat = 'tall' | 'square';

export default function ShareScreen({ route }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { analysis } = route.params;
  const cardRef = useRef<any>(null);
  const [format, setFormat] = useState<CardFormat>('tall');
  const [exporting, setExporting] = useState(false);
  const [captionResponse, setCaptionResponse] = useState<CaptionResponse | null>(null);
  const [captionsLoading, setCaptionsLoading] = useState(true);
  const [captionsError, setCaptionsError] = useState(false);
  const { user } = useAuth();
  const [handle, setHandle] = useState('');
  useEffect(() => {
    if (user) getProfile(user.id).then((p) => { if (p?.username) setHandle('@' + p.username); }).catch(() => {});
  }, [user]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setCaptionsLoading(true);
      setCaptionsError(false);
      const result = await fetchOrGenerateCaptions(analysis, 'savage');
      if (!mounted) return;
      if (result) {
        setCaptionResponse(result);
      } else {
        setCaptionsError(true);
      }
      setCaptionsLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // The roast IS the caption — the witty payload lives in the post text, not crammed into the card.
  const shareText = `“${analysis.roast}”\n\nMy Am I Broke? score: ${analysis.score}/100 — ${getScoreBand(analysis.score).label}. ${BRAND.domain}`;

  const handleCopyCaption = async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch { /* user cancelled */ }
  };

  // Default native back chevron (consistent with every other pushed screen) — no custom headerLeft.
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Share Result',
      headerTitleStyle: {
        fontFamily: Typography.fonts.headingSemi,
        fontSize: Typography.headline.fontSize,
        color: Colors.textPrimary,
      },
      headerStyle: {
        backgroundColor: Colors.background,
      },
    });
  }, [navigation]);

  const handleShare = async () => {
    await Share.share({ message: shareText });
  };

  const handleExportPNG = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
      });
      await Share.share({ url: uri, message: shareText });
    } catch (e) {
      Alert.alert('Export failed', 'Could not capture the card image.');
    } finally {
      setExporting(false);
    }
  };

  // No clipboard module installed → share the link (the share sheet's "Copy" handles a true copy).
  const handleCopyLink = async () => {
    try { await Share.share({ message: BRAND.domain }); } catch { /* cancelled */ }
  };

  const ICON = 24;
  const PLATFORMS = [
    { name: 'TikTok', icon: <FontAwesome6 name="tiktok" size={ICON} color={Colors.textPrimary} />, action: handleExportPNG },
    { name: 'Instagram', icon: <FontAwesome6 name="instagram" size={ICON} color={Colors.textPrimary} />, action: handleExportPNG },
    { name: 'X', icon: <FontAwesome6 name="x-twitter" size={ICON} color={Colors.textPrimary} />, action: handleExportPNG },
    { name: 'Copy Link', icon: <LinkIcon size={ICON} color={Colors.textPrimary} />, action: handleCopyLink },
  ];

  const band = getScoreBand(analysis.score);
  // Short roast → quote it on the (square) card; the tall card prints the full roast below it.
  const roast = analysis.roast ?? '';
  const firstSentence = roast.split(/(?<=[.!?])\s/)[0] ?? roast;
  const hook = roast.length <= 100 ? roast : firstSentence.length <= 100 ? firstSentence : undefined;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="share" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Format toggle */}
        <View style={styles.formatRow}>
          <SectionLabel>Format</SectionLabel>
          <View style={styles.formatToggle}>
            <PressableScale
              style={[styles.formatBtn, format === 'tall' && styles.formatBtnActive]}
              onPress={() => setFormat('tall')}
            >
              <Text style={[styles.formatBtnText, format === 'tall' && styles.formatBtnTextActive]}>9:16 TikTok</Text>
            </PressableScale>
            <PressableScale
              style={[styles.formatBtn, format === 'square' && styles.formatBtnActive]}
              onPress={() => setFormat('square')}
            >
              <Text style={[styles.formatBtnText, format === 'square' && styles.formatBtnTextActive]}>1:1 Instagram</Text>
            </PressableScale>
          </View>
        </View>

        {/* Shareable card — the BrokeCard on a branded frame (figures-free; the roast is the caption) */}
        <SectionLabel>Your Share Card</SectionLabel>
        <ViewShot ref={cardRef} options={{ format: 'png', quality: 1.0 }}>
          <View style={[styles.exportFrame, format === 'square' ? styles.frameSquare : styles.frameTall]}>
            <LinearGradient colors={['#1a0026', '#0d001a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <BrokeCard
              name={handle}
              score={analysis.score}
              bandLabel={band.label}
              bandColor={band.color}
              dateStr={dateStr}
              hook={format === 'tall' ? undefined : hook}
              animated={false}
            />
            {/* Tall (TikTok) format gets the full roast as the hero below the card; square stays compact. */}
            {format === 'tall' && roast ? (
              <View style={styles.roastBlock}>
                <Text style={styles.roastQuote} numberOfLines={8}>“{roast}”</Text>
                {analysis.emotionalStatus?.label ? (
                  <Text style={styles.roastMood}>{analysis.emotionalStatus.emoji} {analysis.emotionalStatus.label}</Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.frameFooter}>{BRAND.domain}</Text>
          </View>
        </ViewShot>

        {/* Export as PNG — primary action: capture the card + open the share sheet */}
        <NeonButton
          label={exporting ? 'Generating…' : 'Export as PNG'}
          onPress={handleExportPNG}
          loading={exporting}
          variant="primary"
          style={{ marginBottom: Spacing.xl }}
        />

        {/* Share platforms */}
        <SectionLabel>Share To</SectionLabel>
        <View style={styles.platformGrid}>
          {PLATFORMS.map((p) => (
            <PressableScale
              key={p.name}
              style={styles.platformBtn}
              onPress={p.action}
            >
              {p.icon}
              <Text style={styles.platformName}>{p.name}</Text>
            </PressableScale>
          ))}
        </View>

        {/* Captions */}
        <SectionLabel>Share Caption</SectionLabel>
        {captionsLoading ? (
          <View style={styles.captionsLoadingBox}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.captionsLoadingText}>Generating captions...</Text>
          </View>
        ) : captionsError || !captionResponse ? (
          <PressableScale style={styles.captionRetryBtn} onPress={() => {
            setCaptionsLoading(true);
            setCaptionsError(false);
            fetchOrGenerateCaptions(analysis, 'savage').then((r) => {
              if (r) setCaptionResponse(r);
              else setCaptionsError(true);
              setCaptionsLoading(false);
            });
          }}>
            <Text style={styles.captionRetryText}>Couldn't generate — tap to retry</Text>
          </PressableScale>
        ) : (
          <View style={styles.captionList}>
            {captionResponse.captions.map((text, i) => (
              <PressableScale
                key={i}
                style={styles.captionItem}
                onPress={() => handleCopyCaption(text)}
              >
                <Text style={styles.captionItemText}>{text}</Text>
                <Text style={styles.captionItemCopy}>Tap to share</Text>
              </PressableScale>
            ))}
          </View>
        )}

        <NeonButton label="Share with Other Apps" onPress={handleShare} variant="secondary" />
      </ScrollView>
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  formatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  formatToggle: { flexDirection: 'row', backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, padding: 2, gap: 0 },
  formatBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm },
  formatBtnActive: { backgroundColor: Colors.accentContainer },
  formatBtnText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  formatBtnTextActive: { color: Colors.accent, fontFamily: Typography.fonts.bodyMed },
  // Branded export frame: a dark gradient canvas (9:16 or 1:1) with the BrokeCard centered + a footer.
  exportFrame: {
    borderRadius: Radius.xl, padding: Spacing.xxl, marginBottom: Spacing.md, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'stretch', gap: Spacing.xl,
  },
  frameTall: { aspectRatio: 9 / 16, width: '100%' },
  frameSquare: { aspectRatio: 1, width: '100%' },
  frameFooter: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textAlign: 'center' },
  // Tall-card roast hero — the full roast as a big quote, with the mood tag.
  roastBlock: { gap: Spacing.sm, paddingHorizontal: Spacing.xs },
  roastQuote: { fontFamily: Typography.fonts.body, fontSize: Typography.title3.fontSize, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 28, textAlign: 'center' },
  roastMood: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.accent, textAlign: 'center' },
  platformGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xxl },
  platformBtn: {
    flex: 1, backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  platformName: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textAlign: 'center' },
  captionsLoadingBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
  captionsLoadingText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textMuted },
  captionRetryBtn: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight },
  captionRetryText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textMuted },
  captionList: { gap: Spacing.sm, marginBottom: Spacing.xl },
  captionItem: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight },
  captionItemText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  captionItemCopy: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.accent, marginTop: Spacing.xs, textAlign: 'right' },
});
