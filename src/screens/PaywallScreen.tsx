import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import NeonButton from '../components/NeonButton';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Paywall'> };

const FEATURES = [
  { icon: '🎯', label: '90-Day Action Plans', detail: 'Personalized weekly goals' },
  { icon: '🏋️', label: 'Debt Payoff Calculator', detail: 'Avalanche & snowball strategies' },
  { icon: '🎲', label: 'Scenario Simulator', detail: 'What-if financial planning' },
  { icon: '🗂️', label: 'Subscription Audit', detail: 'Find and kill unused subs' },
  { icon: '📋', label: 'Monthly Check-Ins', detail: 'Track progress over time' },
  { icon: '📊', label: 'Creator Dashboard', detail: 'Earn by referring friends' },
  { icon: '✨', label: 'Unlimited Analyses', detail: 'No monthly limits' },
  { icon: '🔒', label: 'Ad-free Experience', detail: 'Clean and distraction-free' },
];

export default function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<'monthly' | 'lifetime'>('lifetime');

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      {/* Dismiss handle */}
      <View style={[styles.handleRow, { marginTop: insets.top > 0 ? 8 : 16 }]}>
        <View style={styles.handle} />
      </View>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>✨</Text>
          </LinearGradient>
          <Text style={styles.heroTitle}>Am I Broke? Premium</Text>
          <Text style={styles.heroSub}>Everything you need to stop being broke, for real this time.</Text>
        </View>

        {/* Plan picker */}
        <View style={styles.planRow}>
          <TouchableOpacity
            style={[styles.planCard, plan === 'lifetime' && styles.planCardActive]}
            onPress={() => setPlan('lifetime')}
            activeOpacity={0.8}
          >
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>BEST VALUE</Text>
            </View>
            <Text style={styles.planName}>Lifetime</Text>
            <Text style={styles.planPrice}>$19.99</Text>
            <Text style={styles.planDesc}>One-time purchase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, plan === 'monthly' && styles.planCardActive]}
            onPress={() => setPlan('monthly')}
            activeOpacity={0.8}
          >
            <Text style={styles.planName}>Monthly</Text>
            <Text style={styles.planPrice}>$4.99<Text style={styles.planPer}>/mo</Text></Text>
            <Text style={styles.planDesc}>Cancel anytime</Text>
          </TouchableOpacity>
        </View>

        {/* Features list */}
        <Text style={styles.sectionLabel}>What's Included</Text>
        <View style={styles.featureGroup}>
          {FEATURES.map((f, i) => (
            <React.Fragment key={f.label}>
              {i > 0 && <View style={styles.featureSep} />}
              <View style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                </View>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.featureDetail}>{f.detail}</Text>
                </View>
                <Text style={styles.check}>✓</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* CTA */}
        <NeonButton
          label={plan === 'lifetime' ? 'Get Lifetime Access — $19.99' : 'Start Monthly Plan — $4.99/mo'}
          onPress={() => navigation.navigate('Payment')}
          style={styles.cta}
        />

        <Text style={styles.restoreText}>Restore Purchase · Already subscribed?</Text>
        <Text style={styles.legal}>
          Payment charged to Apple ID. Subscription auto-renews. Cancel anytime in Settings.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handleRow: { alignItems: 'center', marginBottom: 8 },
  handle: { width: 36, height: 5, borderRadius: Radius.pill, backgroundColor: Colors.separator },
  closeBtn: { position: 'absolute', top: 20, right: Spacing.xl, zIndex: 10, padding: 8 },
  closeText: { fontSize: 17, color: Colors.textSecondary },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 8 },
  hero: { alignItems: 'center', marginBottom: 28, marginTop: 4 },
  heroIcon: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroEmoji: { fontSize: 32 },
  heroTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: 26, fontWeight: '700',
    color: Colors.textPrimary, textAlign: 'center', marginBottom: 8,
  },
  heroSub: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 22 },
  planRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  planCard: {
    flex: 1, backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: 16,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
    alignItems: 'center', gap: 4,
    position: 'relative',
  },
  planCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  planBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  planBadgeText: { fontFamily: Typography.fonts.bodySemi, fontSize: 9, color: Colors.background, fontWeight: '700', letterSpacing: 0.5 },
  planName: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textSecondary },
  planPrice: { fontFamily: Typography.fonts.heading, fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  planPer: { fontSize: 14, fontWeight: '400', color: Colors.textSecondary },
  planDesc: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  featureGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 24,
  },
  featureSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 56 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12, minHeight: 50 },
  featureIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  featureIcon: { fontSize: 15 },
  featureInfo: { flex: 1 },
  featureLabel: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary },
  featureDetail: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  check: { fontSize: 16, color: Colors.success, fontWeight: '700' },
  cta: { marginBottom: 14 },
  restoreText: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.tint, textAlign: 'center', marginBottom: 10 },
  legal: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
});
