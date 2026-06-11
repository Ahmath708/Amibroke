import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { enterUp } from '@/components/motion';
import SectionLabel from '@/components/SectionLabel';
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

  // Set header with back arrow
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
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          activeOpacity={0.7} 
          style={{ padding: Spacing.xs, marginLeft: 8 }}
        >
          <Text style={{ fontSize: 24, color: Colors.accent, fontWeight: '300' }}>‹</Text>
        </TouchableOpacity>
      ),
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

  const handleCopyLink = () => {
    Alert.alert('Link Copied', `Share this link: ${BRAND.domain}`);
  };

  const PLATFORMS = [
    { name: 'TikTok', emoji: '📱', color: '#010101', action: handleShare },
    { name: 'Instagram', emoji: '📸', color: '#E1306C', action: handleShare },
    { name: 'Twitter/X', emoji: '🐦', color: '#1DA1F2', action: handleShare },
    { name: 'Copy Link', emoji: '🔗', color: Colors.accentSolid, action: handleCopyLink },
  ];

  const band = getScoreBand(analysis.score);
  // Short roast → quote it on the card; long roast → the card stands alone (full roast is the caption).
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
            <TouchableOpacity
              style={[styles.formatBtn, format === 'tall' && styles.formatBtnActive]}
              onPress={() => setFormat('tall')}
            >
              <Text style={[styles.formatBtnText, format === 'tall' && styles.formatBtnTextActive]}>9:16 TikTok</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatBtn, format === 'square' && styles.formatBtnActive]}
              onPress={() => setFormat('square')}
            >
              <Text style={[styles.formatBtnText, format === 'square' && styles.formatBtnTextActive]}>1:1 Instagram</Text>
            </TouchableOpacity>
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
              hook={hook}
              animated={false}
            />
            <Text style={styles.frameFooter}>{BRAND.domain} · educational only</Text>
          </View>
        </ViewShot>

        {/* Export as PNG */}
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={handleExportPNG}
          disabled={exporting}
          activeOpacity={0.8}
        >
          <Text style={styles.exportBtnText}>
            {exporting ? '📸 Generating...' : '📸 Export as PNG'}
          </Text>
        </TouchableOpacity>

        {/* Share platforms */}
        <SectionLabel>Share To</SectionLabel>
        <View style={styles.platformGrid}>
          {PLATFORMS.map((p) => (
            <TouchableOpacity
              key={p.name}
              style={styles.platformBtn}
              onPress={p.action}
              activeOpacity={0.75}
            >
              <Text style={styles.platformEmoji}>{p.emoji}</Text>
              <Text style={styles.platformName}>{p.name}</Text>
            </TouchableOpacity>
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
          <TouchableOpacity style={styles.captionRetryBtn} onPress={() => {
            setCaptionsLoading(true);
            setCaptionsError(false);
            fetchOrGenerateCaptions(analysis, 'savage').then((r) => {
              if (r) setCaptionResponse(r);
              else setCaptionsError(true);
              setCaptionsLoading(false);
            });
          }} activeOpacity={0.7}>
            <Text style={styles.captionRetryText}>Couldn't generate — tap to retry</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.captionList}>
            {captionResponse.captions.map((text, i) => (
              <TouchableOpacity
                key={i}
                style={styles.captionItem}
                onPress={() => handleCopyCaption(text)}
                activeOpacity={0.75}
              >
                <Text style={styles.captionItemText}>{text}</Text>
                <Text style={styles.captionItemCopy}>Tap to share</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.nativeShareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Text style={styles.nativeShareText}>📤  Share with Other Apps</Text>
        </TouchableOpacity>
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
  exportBtn: {
    backgroundColor: Colors.accentContainer, borderRadius: Radius.xl,
    paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl,
    borderWidth: 1.5, borderColor: Colors.glassBorderLight,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.accent, fontWeight: '600' },
  platformGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xxl },
  platformBtn: {
    flex: 1, backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  platformEmoji: { fontSize: 24 },
  platformName: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textAlign: 'center' },
  nativeShareBtn: {
    backgroundColor: Colors.accentContainer, borderRadius: Radius.xl,
    paddingVertical: Spacing.lg, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.glassBorderLight,
  },
  nativeShareText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.accent, fontWeight: '600' },
  captionsLoadingBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
  captionsLoadingText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textMuted },
  captionRetryBtn: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight },
  captionRetryText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textMuted },
  captionList: { gap: Spacing.sm, marginBottom: Spacing.xl },
  captionItem: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight },
  captionItemText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  captionItemCopy: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.accent, marginTop: Spacing.xs, textAlign: 'right' },
});
