import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import StatusPill from '../components/StatusPill';

type Props = { route: RouteProp<RootStackParamList, 'Share'> };

export default function ShareScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { analysis } = route.params;

  const scoreColor = analysis.score < 40 ? Colors.danger : analysis.score < 65 ? Colors.warning : Colors.success;
  const variant = analysis.score < 40 ? 'danger' : analysis.score < 65 ? 'warning' : 'good';

  const shareText = `I scored ${analysis.score}/100 on Am I Broke? — "${analysis.roast}" Try it: aibroke.app`;

  const handleShare = async () => {
    await Share.share({ message: shareText });
  };

  const PLATFORMS = [
    { name: 'TikTok', emoji: '📱', color: '#010101' },
    { name: 'Instagram', emoji: '📸', color: '#E1306C' },
    { name: 'Twitter/X', emoji: '🐦', color: '#1DA1F2' },
    { name: 'Copy Link', emoji: '🔗', color: Colors.primarySolid },
  ];

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shareable card preview */}
        <Text style={styles.sectionLabel}>Your Share Card</Text>
        <LinearGradient
          colors={['#1a0026', '#0d001a']}
          style={styles.shareCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.shareCardHeader}>
            <Text style={styles.shareCardApp}>💸 Am I Broke?</Text>
            <Text style={styles.shareCardDate}>May 2026</Text>
          </View>

          <Text style={[styles.shareCardScore, { color: scoreColor }]}>{analysis.score}</Text>
          <StatusPill label={analysis.scoreLabel} variant={variant} size="md" />

          <Text style={styles.shareCardRoast}>"{analysis.roast}"</Text>

          <View style={styles.shareCardStats}>
            {[
              { label: 'Income', value: `$${analysis.monthlyIncome.toLocaleString()}` },
              { label: 'Expenses', value: `$${analysis.monthlyExpenses.toLocaleString()}` },
              { label: 'Savings Rate', value: `${analysis.savingsRate.toFixed(0)}%` },
            ].map((s) => (
              <View key={s.label} style={styles.shareCardStat}>
                <Text style={styles.shareCardStatValue}>{s.value}</Text>
                <Text style={styles.shareCardStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.shareCardUrl}>aibroke.app</Text>
        </LinearGradient>

        {/* Share platforms */}
        <Text style={styles.sectionLabel}>Share To</Text>
        <View style={styles.platformGrid}>
          {PLATFORMS.map((p) => (
            <TouchableOpacity
              key={p.name}
              style={styles.platformBtn}
              onPress={handleShare}
              activeOpacity={0.75}
            >
              <Text style={styles.platformEmoji}>{p.emoji}</Text>
              <Text style={styles.platformName}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Share text */}
        <Text style={styles.sectionLabel}>Share Message</Text>
        <View style={styles.shareTextBox}>
          <Text style={styles.shareTextContent}>{shareText}</Text>
        </View>

        <TouchableOpacity style={styles.nativeShareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Text style={styles.nativeShareText}>📤  Share with Other Apps</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  shareCard: {
    borderRadius: Radius.xl, padding: 24, marginBottom: 28,
    alignItems: 'center', gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    shadowColor: Colors.primarySolid, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24,
  },
  shareCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  shareCardApp: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textSecondary },
  shareCardDate: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textMuted },
  shareCardScore: { fontFamily: Typography.fonts.heading, fontSize: 80, fontWeight: '700', letterSpacing: -3 },
  shareCardRoast: {
    fontFamily: Typography.fonts.body, fontSize: 14,
    color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', lineHeight: 20,
    paddingHorizontal: 8,
  },
  shareCardStats: { flexDirection: 'row', gap: 20, marginTop: 4 },
  shareCardStat: { alignItems: 'center' },
  shareCardStatValue: { fontFamily: Typography.fonts.heading, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  shareCardStatLabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  shareCardUrl: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  platformGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  platformBtn: {
    flex: 1, backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: 14, alignItems: 'center', gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  platformEmoji: { fontSize: 24 },
  platformName: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  shareTextBox: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 20,
  },
  shareTextContent: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  nativeShareBtn: {
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.xl,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.glassBorderLight,
  },
  nativeShareText: { fontFamily: Typography.fonts.bodySemi, fontSize: 16, color: Colors.primary, fontWeight: '600' },
});
