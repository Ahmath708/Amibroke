import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Share, Animated,
} from 'react-native';
import SectionLabel from '@/components/SectionLabel';
import AppTextInput from '@/components/AppTextInput';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import GlassCard from '@/components/GlassCard';
import NeonButton from '@/components/NeonButton';
import LoadingState from '@/components/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { getCreatorStats, generateReferralCode, getReferralCode, batchRoast } from '@/services/creator';
import { FEATURES } from '@/config/features';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'CreatorDashboard'> };

const TONES = ['savage', 'gentle', 'therapist', 'older_sibling', 'finance_bro'];

export default function CreatorDashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [batchInputs, setBatchInputs] = useState<string[]>(['']);
  const [selectedTone, setSelectedTone] = useState('savage');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const { animatedStyle } = useEntryAnimation();

  useEffect(() => {
    if (!FEATURES.CREATOR_DASHBOARD) {
      navigation.goBack();
      return;
    }

    (async () => {
      if (user) {
        const [statsData, code] = await Promise.all([
          getCreatorStats(user.id),
          getReferralCode(user.id),
        ]);
        setStats(statsData);
        setReferralCode(code);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleGenerateCode = async () => {
    if (!user) return;
    const code = await generateReferralCode(user.id);
    setReferralCode(code);
    Alert.alert('Referral Code Generated', `Your code: ${code}`);
  };

  const handleShareCode = async () => {
    if (!referralCode) return;
    await Share.share({
      message: `Roast your finances with Am I Broke! Use my code ${referralCode} for a personalized AI roast 🔥 aibroke.app`,
    });
  };

  const addBatchInput = () => {
    setBatchInputs((prev) => [...prev, '']);
  };

  const updateBatchInput = (index: number, value: string) => {
    setBatchInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removeBatchInput = (index: number) => {
    setBatchInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBatchRoast = async () => {
    const validInputs = batchInputs.filter((i) => i.trim().length > 0);
    if (validInputs.length === 0) {
      Alert.alert('No Input', 'Please enter at least one financial situation to roast.');
      return;
    }

    setBatchLoading(true);
    const results = await batchRoast(validInputs, selectedTone);
    setBatchResults(results);
    setBatchLoading(false);
  };

  if (loading) return <LoadingState />;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="creator" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Grid */}
        <SectionLabel>Your Creator Stats</SectionLabel>
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Roasts', value: stats?.totalRoasts || 0, emoji: '🔥' },
            { label: 'Total Views', value: stats?.totalViews || 0, emoji: '👀' },
            { label: 'Total Shares', value: stats?.totalShares || 0, emoji: '📤' },
            { label: 'Earnings', value: `$${(stats?.totalEarnings || 0).toFixed(2)}`, emoji: '💰' },
          ].map((s, i) => (
            <GlassCard key={i} style={styles.statCard}>
              <Text style={styles.statEmoji}>{s.emoji}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Referral Code */}
        <SectionLabel>Your Referral Code</SectionLabel>
        <GlassCard style={styles.referralCard}>
          {referralCode ? (
            <>
              <Text style={styles.referralCode}>{referralCode}</Text>
              <NeonButton label="Share Code" onPress={handleShareCode} variant="tinted" style={styles.shareBtn} />
            </>
          ) : (
            <NeonButton label="Generate Referral Code" onPress={handleGenerateCode} />
          )}
        </GlassCard>

        {/* Batch Roast Mode */}
        <SectionLabel>Batch Roast Mode</SectionLabel>
        <GlassCard style={styles.batchCard}>
          <Text style={styles.batchDesc}>Roast multiple financial situations at once. Perfect for creator content.</Text>

          {/* Tone selector */}
          <View style={styles.toneRow}>
            {TONES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.toneBtn, selectedTone === t && styles.toneBtnActive]}
                onPress={() => setSelectedTone(t)}
              >
                <Text style={[styles.toneText, selectedTone === t && styles.toneTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Inputs */}
          {batchInputs.map((input, i) => (
            <View key={i} style={styles.batchInputRow}>
              <AppTextInput
                style={styles.batchInput}
                placeholder={`Situation ${i + 1}: "I make $3k but spend $3.5k..."`}
                placeholderTextColor={Colors.textMuted}
                value={input}
                onChangeText={(v) => updateBatchInput(i, v)}
                multiline
              />
              {batchInputs.length > 1 && (
                <TouchableOpacity onPress={() => removeBatchInput(i)} style={styles.removeBtn}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity onPress={addBatchInput} style={styles.addBtn}>
            <Text style={styles.addText}>+ Add Another</Text>
          </TouchableOpacity>

          <NeonButton
            label={batchLoading ? 'Roasting...' : `Roast ${batchInputs.filter((i) => i.trim()).length} Situations`}
            onPress={handleBatchRoast}
            loading={batchLoading}
            disabled={batchLoading}
            style={styles.roastBtn}
          />
        </GlassCard>

        {/* Batch Results */}
        {batchResults.length > 0 && (
          <>
            <SectionLabel>Results</SectionLabel>
            {batchResults.map((r, i) => (
              <GlassCard key={i} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultScore}>{r.score || '?'}/100</Text>
                  <Text style={styles.resultLabel}>{r.scoreLabel || 'Error'}</Text>
                </View>
                {r.roast && <Text style={styles.resultRoast}>"{r.roast}"</Text>}
                {r.error && <Text style={styles.resultError}>{r.error}</Text>}
              </GlassCard>
            ))}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { width: '48%', padding: Spacing.md, alignItems: 'center' },
  statEmoji: { fontSize: 24, marginBottom: Spacing.xs },
  statValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  referralCard: { padding: Spacing.lg, alignItems: 'center', gap: Spacing.md },
  referralCode: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.primary, letterSpacing: 2 },
  shareBtn: { width: '100%' },
  batchCard: { padding: Spacing.lg, gap: Spacing.md },
  batchDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  toneRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  toneBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.pill, backgroundColor: Colors.surfaceElevated },
  toneBtnActive: { backgroundColor: Colors.primaryContainer },
  toneText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary },
  toneTextActive: { color: Colors.primary },
  batchInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  batchInput: {
    flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize,
    color: Colors.textPrimary, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    padding: Spacing.sm, minHeight: 60,
  },
  removeBtn: { padding: Spacing.sm },
  removeText: { fontSize: Typography.callout.fontSize, color: Colors.danger },
  addBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  addText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.primary },
  roastBtn: { marginTop: Spacing.xs },
  resultCard: { padding: Spacing.lg, marginBottom: Spacing.sm },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  resultScore: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.primary },
  resultLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  resultRoast: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },
  resultError: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.danger },
});
