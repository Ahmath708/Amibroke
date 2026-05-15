import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import StatusPill from '../components/StatusPill';

type Category = 'all' | 'savings' | 'cards' | 'investing' | 'tools';

const PRODUCTS = [
  { id: '1', name: 'Marcus by Goldman', category: 'savings', icon: '🏦', apy: '5.50% APY', badge: 'Top Pick', desc: 'High-yield savings. No fees. FDIC insured up to $250k.', cta: 'Open Account', commission: '$30' },
  { id: '2', name: 'Fidelity Investments', category: 'investing', icon: '📈', apy: '$0 fees', badge: 'Best Free', desc: 'Zero-fee index funds and fractional shares from $1.', cta: 'Start Investing', commission: '$25' },
  { id: '3', name: 'YNAB', category: 'tools', icon: '📊', apy: '34-day free', badge: 'Fan Fave', desc: 'Zero-based budgeting app. Average user saves $600 in month 1.', cta: 'Try Free', commission: '$15' },
  { id: '4', name: 'Citi Double Cash', category: 'cards', icon: '💳', apy: '2% cashback', badge: 'No Annual Fee', desc: 'Simple flat 2% on everything. No categories to track.', cta: 'Apply Now', commission: '$75' },
  { id: '5', name: 'Betterment', category: 'investing', icon: '🤖', apy: '0.25%/yr', badge: 'Robo-Advisor', desc: 'Automated investing with tax-loss harvesting and rebalancing.', cta: 'Get Started', commission: '$20' },
  { id: '6', name: 'Ally Bank', category: 'savings', icon: '🐷', apy: '4.75% APY', badge: 'Fan Fave', desc: 'Online bank with no minimums, great rates, and 24/7 support.', cta: 'Open Account', commission: '$30' },
];

const TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'savings', label: 'Savings' },
  { key: 'cards', label: 'Cards' },
  { key: 'investing', label: 'Investing' },
  { key: 'tools', label: 'Tools' },
];

export default function AffiliateScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Category>('all');

  const filtered = tab === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === tab);

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Curated financial products that actually make sense for your situation.
        </Text>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ℹ️ Some links are affiliate links. We only recommend products we'd use ourselves.
          </Text>
        </View>

        {/* Category tabs */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.tabScroll} contentContainerStyle={styles.tabContent}
        >
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products */}
        <View style={styles.productGroup}>
          {filtered.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <View style={styles.productSep} />}
              <View style={styles.productRow}>
                <View style={styles.productIcon}>
                  <Text style={styles.productIconText}>{p.icon}</Text>
                </View>
                <View style={styles.productInfo}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName}>{p.name}</Text>
                    <StatusPill label={p.badge} variant="premium" />
                  </View>
                  <Text style={[styles.productApy, { color: Colors.success }]}>{p.apy}</Text>
                  <Text style={styles.productDesc}>{p.desc}</Text>
                  <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.75}>
                    <Text style={styles.ctaBtnText}>{p.cta} →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Earn callout */}
        <LinearGradient
          colors={['rgba(189,0,255,0.18)', 'rgba(0,224,255,0.12)']}
          style={styles.earnBanner}
        >
          <Text style={styles.earnTitle}>💰 Earn on referrals</Text>
          <Text style={styles.earnBody}>
            Share these products and earn $15–75 per signup. Visit the Creator Dashboard to track your earnings.
          </Text>
        </LinearGradient>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  intro: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 12 },
  disclaimer: {
    backgroundColor: Colors.infoContainer, borderRadius: Radius.md, padding: 10, marginBottom: 16,
  },
  disclaimerText: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.secondary, lineHeight: 17 },
  tabScroll: { marginHorizontal: -Spacing.xl, marginBottom: 20 },
  tabContent: { paddingHorizontal: Spacing.xl, gap: 8 },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  tabBtnActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  tabText: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  productGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 20,
  },
  productSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
  productRow: { flexDirection: 'row', padding: 14, gap: 12 },
  productIcon: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center',
  },
  productIconText: { fontSize: 22 },
  productInfo: { flex: 1, gap: 4 },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  productName: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  productApy: { fontFamily: Typography.fonts.bodySemi, fontSize: 13, fontWeight: '600' },
  productDesc: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  ctaBtn: { alignSelf: 'flex-start', marginTop: 4 },
  ctaBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.tint, fontWeight: '500' },
  earnBanner: {
    borderRadius: Radius.lg, padding: 16, gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  earnTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: 16, color: Colors.textPrimary, fontWeight: '600' },
  earnBody: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
