import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Alert,
} from 'react-native';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesOffering } from 'react-native-purchases';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, PURCHASE_PRODUCTS } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import { trackPaywallViewed, trackPurchaseInitiated, trackPurchaseCompleted, trackPurchaseFailed } from '@/services/analytics';
import ScreenBackground from '@/components/ScreenBackground';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getCurrentOffering, packageForTier, purchasePackage, restorePurchases, tierFromCustomerInfo } from '@/services/purchases';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Paywall'> };

const FREE_FEATURES = [
  { icon: '💯', label: 'Financial Health Score (0–100)' },
  { icon: '🍩', label: 'Spending Breakdown Chart' },
  { icon: '🔥', label: 'AI Roast One-Liner' },
  { icon: '🖼️', label: 'Shareable Result Card' },
];

const COMPARE = [
  { feature: '90-Day Step-by-Step Plan', free: false, ap: true, dd: true },
  { feature: 'Weekly Goals with Dollar Amounts', free: false, ap: true, dd: true },
  { feature: 'Debt Payoff Timeline', free: false, ap: true, dd: true },
  { feature: 'Subscription Audit', free: true, ap: true, dd: true },
  { feature: 'Prioritized Fix List', free: false, ap: true, dd: true },
  { feature: 'Scenario Simulator', free: false, ap: false, dd: true },
  { feature: 'Avalanche vs Snowball', free: false, ap: false, dd: true },
  { feature: 'Downloadable PDF Report', free: false, ap: false, dd: true },
];

export default function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<'action_plan' | 'deep_dive'>('deep_dive');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [processing, setProcessing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { animatedStyle } = useEntryAnimation();
  const { user } = useAuth();
  const { refresh } = useSubscription();

  useEffect(() => {
    trackPaywallViewed(selected);
  }, [selected]);

  useEffect(() => {
    getCurrentOffering().then(setOffering);
  }, []);

  const product = PURCHASE_PRODUCTS[selected];
  const actionPlan = PURCHASE_PRODUCTS.action_plan!;
  const deepDive = PURCHASE_PRODUCTS.deep_dive!;

  // Prefer RevenueCat's localized, store-accurate price; fall back to static
  // copy before RevenueCat is configured.
  const priceLabel = (tier: 'action_plan' | 'deep_dive', fallback: number): string => {
    const pkg = packageForTier(offering, tier);
    return pkg ? pkg.product.priceString : `$${fallback.toFixed(2)}`;
  };

  const handleSubscribe = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to start your subscription.');
      navigation.navigate('Login');
      return;
    }
    const pkg = packageForTier(offering, selected);
    if (!pkg) {
      Alert.alert('Unavailable', 'Subscriptions aren’t available right now. Please try again later.');
      return;
    }
    setProcessing(true);
    await trackPurchaseInitiated(selected, product!.price);
    const result = await purchasePackage(pkg);
    setProcessing(false);

    if (result.cancelled) return;
    if (result.error || !result.customerInfo) {
      await trackPurchaseFailed(selected, result.error ?? 'purchase_failed');
      Alert.alert('Purchase Error', result.error ?? 'Something went wrong. Please try again.');
      return;
    }
    await trackPurchaseCompleted(selected, product!.price);
    await refresh();
    navigation.goBack();
  };

  const handleRestore = async () => {
    setRestoring(true);
    const info = await restorePurchases();
    setRestoring(false);
    const tier = tierFromCustomerInfo(info);
    if (tier === 'free') {
      Alert.alert('No Purchases Found', 'We couldn’t find an active subscription to restore.');
      return;
    }
    await refresh();
    Alert.alert('Restored', 'Your subscription has been restored.');
    navigation.goBack();
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="paywall" />
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
        <View style={styles.hero}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>💎</Text>
          </LinearGradient>
          <Text style={styles.heroTitle}>Your financial wake-up call is ready.</Text>
          <Text style={styles.heroSub}>
            You've seen the score. Now get the exact roadmap to fix it — before another paycheck disappears.
          </Text>
          <View style={styles.heroUrgency}>
            <Text style={styles.heroUrgencyDot}>●</Text>
            <Text style={styles.heroUrgencyText}>4,283 people unlocked their plan today</Text>
          </View>
        </View>

        {/* Free tier summary */}
        <View style={styles.freeBox}>
          <Text style={styles.freeTitle}>Free — Unlimited Access</Text>
          <View style={styles.freeFeatureList}>
            {FREE_FEATURES.map((f) => (
              <View key={f.label} style={styles.freeFeatureRow}>
                <Text style={styles.freeFeatureIcon}>{f.icon}</Text>
                <Text style={styles.freeFeatureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Preview locked content */}
        <Text style={styles.sectionLabel}>Preview What's Inside</Text>
        <View style={styles.previewList}>
          <LinearGradient colors={['rgba(189,0,255,0.2)', 'rgba(0,224,255,0.08)']} style={styles.previewCard}>
            <Text style={styles.previewIcon}>🗓️</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewTitle}>Your 90-Day Action Plan</Text>
              <Text style={styles.previewDesc}>Week-by-week roadmap with specific dollar targets</Text>
            </View>
            <View style={styles.previewLock}>
              <Text style={styles.previewLockIcon}>🔒</Text>
            </View>
          </LinearGradient>
          <LinearGradient colors={['rgba(231,0,110,0.2)', 'rgba(189,0,255,0.08)']} style={styles.previewCard}>
            <Text style={styles.previewIcon}>💳</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewTitle}>Debt Payoff Strategy</Text>
              <Text style={styles.previewDesc}>See how much interest you're burning and when you'll be free</Text>
            </View>
            <View style={styles.previewLock}>
              <Text style={styles.previewLockIcon}>🔒</Text>
            </View>
          </LinearGradient>
          <LinearGradient colors={['rgba(0,224,255,0.2)', 'rgba(57,255,20,0.08)']} style={styles.previewCard}>
            <Text style={styles.previewIcon}>📊</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewTitle}>Scenario Simulator</Text>
              <Text style={styles.previewDesc}>What if you got a raise? Cut DoorDash? Find out instantly</Text>
            </View>
            <View style={styles.previewLock}>
              <Text style={styles.previewLockIcon}>🔒</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Product picker */}
        <Text style={styles.sectionLabel}>Choose Your Upgrade</Text>
        <View style={styles.planRow}>
          <TouchableOpacity
            style={[styles.planCard, selected === 'action_plan' && styles.planCardActive]}
            onPress={() => setSelected('action_plan')}
            activeOpacity={0.8}
          >
            <Text style={styles.planName}>{actionPlan.label}</Text>
            <Text style={styles.planPrice}>{priceLabel('action_plan', actionPlan.price)}</Text>
            <Text style={styles.planDesc}>per month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, styles.planCardFeatured, selected === 'deep_dive' && styles.planCardActive]}
            onPress={() => setSelected('deep_dive')}
            activeOpacity={0.8}
          >
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>BEST VALUE</Text>
            </View>
            <Text style={styles.planName}>{deepDive.label}</Text>
            <Text style={styles.planPrice}>{priceLabel('deep_dive', deepDive.price)}</Text>
            <Text style={styles.planDesc}>per month</Text>
          </TouchableOpacity>
        </View>

        {/* Feature comparison */}
        <Text style={styles.sectionLabel}>What's Included</Text>
        <View style={styles.compareGroup}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareHeaderFeature}>Feature</Text>
            <Text style={styles.compareHeaderTier}>Free</Text>
            <Text style={[styles.compareHeaderTier, selected === 'action_plan' && styles.compareHeaderTierActive]}>AP</Text>
            <Text style={[styles.compareHeaderTier, selected === 'deep_dive' && styles.compareHeaderTierActive]}>DD</Text>
          </View>
          {COMPARE.map((row, i) => (
            <React.Fragment key={row.feature}>
              {i > 0 && <View style={styles.compareSep} />}
              <View style={styles.compareRow}>
                <Text style={styles.compareFeature}>{row.feature}</Text>
                <Text style={[styles.compareCheck, row.free ? styles.checkYes : styles.checkNo]}>
                  {row.free ? '✓' : '—'}
                </Text>
                <Text style={[styles.compareCheck, row.ap ? styles.checkYes : styles.checkNo]}>
                  {row.ap ? '✓' : '—'}
                </Text>
                <Text style={[styles.compareCheck, row.dd ? styles.checkYes : styles.checkNo]}>
                  {row.dd ? '✓' : '—'}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {product && (
          <NeonButton
            label={processing ? '' : `Start 7-Day Free Trial`}
            onPress={handleSubscribe}
            loading={processing}
            style={styles.cta}
          />
        )}

        <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          {product!.label} is {priceLabel(selected, product!.price)}/month after a 7-day free
          trial. Auto-renews monthly; cancel anytime in your App Store settings. Payment is
          charged to your Apple ID.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handleRow: { alignItems: 'center', marginBottom: Spacing.sm },
  handle: { width: 36, height: 5, borderRadius: Radius.pill, backgroundColor: Colors.separator },
  closeBtn: { position: 'absolute', top: Spacing.xl, right: Spacing.xl, zIndex: 10, padding: Spacing.sm },
  closeText: { fontSize: Typography.headline.fontSize, color: Colors.textSecondary },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  hero: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.xs },
  heroIcon: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  heroEmoji: { fontSize: 32 },
  heroTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: Typography.title2.fontSize, fontWeight: '700',
    color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm,
  },
  heroSub: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, textAlign: 'center', maxWidth: 300, lineHeight: 22 },
  heroUrgency: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  heroUrgencyDot: { fontSize: 8, color: Colors.success },
  heroUrgencyText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted },
  previewList: { gap: Spacing.sm, marginBottom: Spacing.xl },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  previewIcon: { fontSize: Typography.title2.fontSize },
  previewContent: { flex: 1 },
  previewTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  previewDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 1 },
  previewLock: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  previewLockIcon: { fontSize: Typography.subhead.fontSize },
  freeBox: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  freeTitle: { fontFamily: Typography.fonts.heading, fontSize: Typography.callout.fontSize, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  freeFeatureList: { gap: Spacing.xs },
  freeFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  freeFeatureIcon: { fontSize: Typography.subhead.fontSize },
  freeFeatureLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  planRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  planCard: {
    flex: 1, backgroundColor: Colors.groupedRow,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
    alignItems: 'center', gap: Spacing.xs,
    position: 'relative',
  },
  planCardFeatured: { borderColor: Colors.primary, borderWidth: 1.5 },
  planCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  planBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs - 1, marginBottom: Spacing.xs,
  },
  planBadgeText: { fontFamily: Typography.fonts.bodySemi, fontSize: 9, color: Colors.background, fontWeight: '700', letterSpacing: 0.5 },
  planName: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  planPrice: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.textPrimary },
  planDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  compareGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.xl,
  },
  compareHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.primaryContainer },
  compareHeaderFeature: { flex: 2.5, fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  compareHeaderTier: { flex: 1, textAlign: 'center', fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  compareHeaderTierActive: { color: Colors.primary },
  compareSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.md },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, minHeight: 40 },
  compareFeature: { flex: 2.5, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  compareCheck: { flex: 1, textAlign: 'center', fontSize: Typography.subhead.fontSize, fontWeight: '600' },
  checkYes: { color: Colors.success },
  checkNo: { color: Colors.textMuted },
  cta: { marginBottom: Spacing.sm },
  restoreBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  restoreText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textDecorationLine: 'underline' },
  legal: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
});
