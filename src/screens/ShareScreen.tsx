import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share, ScrollView, Alert, Animated, ActivityIndicator,
} from 'react-native';
import SectionLabel from '@/components/SectionLabel';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation } from '@react-navigation/native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { getScoreBand } from '@shared/scoring/bands.ts';
import StatusPill from '@/components/StatusPill';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';
import { fetchOrGenerateCaptions } from '@/services/claudeApi';
import type { CaptionResponse } from '@shared/types';

type Props = { route: RouteProp<RootStackParamList, 'Share'> };

type CardFormat = 'tall' | 'square';
type CardTheme = 'dark' | 'light';

export default function ShareScreen({ route }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { analysis } = route.params;
  const cardRef = useRef<any>(null);
  const [format, setFormat] = useState<CardFormat>('tall');
  const [theme, setTheme] = useState<CardTheme>('dark');
  const [exporting, setExporting] = useState(false);
  const [captionResponse, setCaptionResponse] = useState<CaptionResponse | null>(null);
  const [captionsLoading, setCaptionsLoading] = useState(true);
  const [captionsError, setCaptionsError] = useState(false);
  const { animatedStyle } = useEntryAnimation();

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

  const shareText = captionResponse?.captions?.[0]
    ? captionResponse.captions[0]
    : `I scored ${analysis.score}/100 on Am I Broke? — "${analysis.roast}" Try it: aibroke.app`;

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
          <Text style={{ fontSize: 24, color: Colors.primary, fontWeight: '300' }}>‹</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const scoreColor = analysis.scoreColor ?? getScoreBand(analysis.score).color;

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
    Alert.alert('Link Copied', 'Share this link: aibroke.app');
  };

  const PLATFORMS = [
    { name: 'TikTok', emoji: '📱', color: '#010101', action: handleShare },
    { name: 'Instagram', emoji: '📸', color: '#E1306C', action: handleShare },
    { name: 'Twitter/X', emoji: '🐦', color: '#1DA1F2', action: handleShare },
    { name: 'Copy Link', emoji: '🔗', color: Colors.primarySolid, action: handleCopyLink },
  ];

  const isDark = theme === 'dark';
  const cardBg = isDark ? ['#1a0026', '#0d001a'] : ['#ffffff', '#f0f0f5'];
  const cardTextColor = isDark ? Colors.textPrimary : '#1a1a2e';
  const cardSubtextColor = isDark ? Colors.textSecondary : '#555';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
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

        {/* Theme toggle */}
        <View style={styles.formatRow}>
          <SectionLabel>Theme</SectionLabel>
          <View style={styles.formatToggle}>
            <TouchableOpacity
              style={[styles.formatBtn, theme === 'dark' && styles.formatBtnActive]}
              onPress={() => setTheme('dark')}
            >
              <Text style={[styles.formatBtnText, theme === 'dark' && styles.formatBtnTextActive]}>🌙 Dark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatBtn, theme === 'light' && styles.formatBtnActive]}
              onPress={() => setTheme('light')}
            >
              <Text style={[styles.formatBtnText, theme === 'light' && styles.formatBtnTextActive]}>☀️ Light</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Shareable card preview */}
        <SectionLabel>Your Share Card</SectionLabel>
        <ViewShot ref={cardRef} options={{ format: 'png', quality: 1.0 }}>
          <LinearGradient
            colors={cardBg as [string, string]}
            style={[styles.shareCard, format === 'square' ? styles.shareCardSquare : styles.shareCardTall]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={styles.shareCardHeader}>
              <Text style={[styles.shareCardApp, { color: cardSubtextColor }]}>💸 Am I Broke?</Text>
              <Text style={[styles.shareCardDate, { color: cardSubtextColor }]}>{dateStr}</Text>
            </View>

            <Text style={[styles.shareCardScore, { color: scoreColor }]}>{analysis.score}</Text>
            <StatusPill label={analysis.scoreLabel} color={scoreColor} size="md" />

            {analysis.topFix && (
              <View style={styles.shareCardFix}>
                <Text style={styles.shareCardFixLabel}>FIX THIS:</Text>
                <Text style={[styles.shareCardFixText, { color: cardSubtextColor }]}>{analysis.topFix.action}</Text>
              </View>
            )}

            <Text style={[styles.shareCardRoast, { color: cardSubtextColor }]}>
              "{analysis.roast}"
            </Text>

            <View style={styles.shareCardStats}>
              {[
                { label: 'Income', value: `$${analysis.monthlyIncome.value.toLocaleString()}` },
                { label: 'Expenses', value: `$${analysis.monthlyExpenses.value.toLocaleString()}` },
                { label: 'Savings Rate', value: `${analysis.savingsRate.toFixed(0)}%` },
              ].map((s) => (
                <View key={s.label} style={styles.shareCardStat}>
                  <Text style={[styles.shareCardStatValue, { color: cardTextColor }]}>{s.value}</Text>
                  <Text style={[styles.shareCardStatLabel, { color: cardSubtextColor }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.shareCardFooter}>
              <Text style={[styles.shareCardFooterText, { color: cardSubtextColor }]}>aibroke.app</Text>
              <Text style={[styles.shareCardFooterDisclaimer, { color: cardSubtextColor }]}>Educational purposes only</Text>
            </View>
          </LinearGradient>
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
            <ActivityIndicator size="small" color={Colors.primary} />
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  formatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  formatToggle: { flexDirection: 'row', backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, padding: 2, gap: 0 },
  formatBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm },
  formatBtnActive: { backgroundColor: Colors.primaryContainer },
  formatBtnText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  formatBtnTextActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  shareCard: {
    borderRadius: Radius.xl, padding: Spacing.xxl, marginBottom: Spacing.md,
    alignItems: 'center', gap: Spacing.md, justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  shareCardTall: { aspectRatio: 9 / 16, width: '100%' },
  shareCardSquare: { aspectRatio: 1, width: '100%' },
  shareCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  shareCardApp: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize },
  shareCardDate: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize },
  shareCardScore: { fontFamily: Typography.fonts.heading, fontSize: 72, fontWeight: '700', letterSpacing: -3 },
  shareCardFix: {
    backgroundColor: 'rgba(231,0,110,0.15)',
    borderRadius: Radius.md, padding: Spacing.sm, alignSelf: 'stretch',
    borderLeftWidth: 2, borderLeftColor: Colors.tertiarySolid,
  },
  shareCardFixLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 9, color: Colors.tertiary, letterSpacing: 0.5, marginBottom: 2 },
  shareCardFixText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, lineHeight: 16 },
  shareCardRoast: {
    fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize,
    fontStyle: 'italic', textAlign: 'center', lineHeight: 20,
    paddingHorizontal: Spacing.sm,
  },
  shareCardStats: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.xs },
  shareCardStat: { alignItems: 'center' },
  shareCardStatValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.callout.fontSize, fontWeight: '700' },
  shareCardStatLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, marginTop: 2 },
  shareCardFooter: { alignItems: 'center', marginTop: Spacing.xs },
  shareCardFooterText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize },
  shareCardFooterDisclaimer: { fontFamily: Typography.fonts.body, fontSize: 9, marginTop: 2 },
  exportBtn: {
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.xl,
    paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl,
    borderWidth: 1.5, borderColor: Colors.glassBorderLight,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.primary, fontWeight: '600' },
  platformGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xxl },
  platformBtn: {
    flex: 1, backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  platformEmoji: { fontSize: 24 },
  platformName: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, textAlign: 'center' },
  shareTextBox: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xl,
  },
  shareTextContent: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  nativeShareBtn: {
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.xl,
    paddingVertical: Spacing.lg, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.glassBorderLight,
  },
  nativeShareText: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize, color: Colors.primary, fontWeight: '600' },
  captionsLoadingBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
  captionsLoadingText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textMuted },
  captionRetryBtn: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight },
  captionRetryText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textMuted },
  captionList: { gap: Spacing.sm, marginBottom: Spacing.xl },
  captionItem: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight },
  captionItemText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, lineHeight: 20 },
  captionItemCopy: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.primary, marginTop: Spacing.xs, textAlign: 'right' },
});
