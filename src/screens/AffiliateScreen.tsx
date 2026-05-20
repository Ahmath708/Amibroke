import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import StatusPill from '@/components/StatusPill';
import { AFFILIATE_PRODUCTS, trackAffiliateClick } from '@/services/affiliate';
import { trackEvent } from '@/services/analytics';

type Category = 'all' | 'savings' | 'cards' | 'investing' | 'tools' | 'insurance';

const TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'savings', label: 'Savings' },
  { key: 'cards', label: 'Cards' },
  { key: 'investing', label: 'Investing' },
  { key: 'tools', label: 'Tools' },
  { key: 'insurance', label: 'Insurance' },
];

export default function AffiliateScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Category>('all');

  const filtered = tab === 'all' ? AFFILIATE_PRODUCTS : AFFILIATE_PRODUCTS.filter((p) => p.category === tab);

  const handleProductClick = async (product: typeof AFFILIATE_PRODUCTS[0]) => {
    await trackAffiliateClick(product.id);
    await trackEvent('affiliate_product_clicked', {
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      commission: product.commission,
    });

    Linking.openURL(product.affiliateUrl).catch(() => {
      Alert.alert('Could not open link', 'Please try again later.');
    });
  };

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
                    <StatusPill label={p.featured ? 'Featured' : p.category} variant="premium" />
                  </View>
                  <Text style={[styles.productApy, { color: Colors.success }]}>{p.description}</Text>
                  <TouchableOpacity
                    style={styles.ctaBtn}
                    activeOpacity={0.75}
                    onPress={() => handleProductClick(p)}
                  >
                    <Text style={styles.ctaBtnText}>Learn More →</Text>
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
            Share these products and earn commissions per signup. Visit the Creator Dashboard to track your earnings.
          </Text>
        </LinearGradient>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  intro: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  disclaimer: {
    backgroundColor: Colors.infoContainer, borderRadius: Radius.md, padding: Spacing.sm + 2, marginBottom: Spacing.lg,
  },
  disclaimerText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.secondary, lineHeight: 17 },
  tabScroll: { marginHorizontal: -Spacing.xl, marginBottom: Spacing.xl },
  tabContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  tabBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  tabBtnActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  tabText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fonts.bodyMed },
  productGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: Spacing.xl,
  },
  productSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
  productRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md },
  productIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center',
  },
  productIconText: { fontSize: Typography.title2.fontSize },
  productInfo: { flex: 1, gap: Spacing.xs },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  productName: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  productApy: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  productDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  ctaBtn: { alignSelf: 'flex-start', marginTop: Spacing.xs },
  ctaBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.tint, fontWeight: '500' },
  earnBanner: {
    borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.xs + 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  earnTitle: { fontFamily: Typography.fonts.headingSemi, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, fontWeight: '600' },
  earnBody: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 19 },
});
