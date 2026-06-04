import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, Alert,
} from 'react-native';
import {
  SparklesIcon, CalendarIcon, CreditCardIcon, ChartBarIcon, LockClosedIcon, XMarkIcon,
} from 'react-native-heroicons/outline';
import SectionLabel from '@/components/SectionLabel';
import { PressableScale } from '@/components/motion';
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

type IconCmp = React.ComponentType<{ size?: number; color?: string }>;
// Locked features previewed on the paywall. Heroicons (no emoji) for a premium read.
const PREVIEW: { Icon: IconCmp; title: string; desc: string; state: 'locked' | 'soon' }[] = [
  { Icon: CalendarIcon, title: 'Your 90-Day Action Plan', desc: 'Week-by-week roadmap with specific dollar targets', state: 'locked' },
  { Icon: CreditCardIcon, title: 'Debt Payoff Strategy', desc: "See how much interest you're burning and when you'll be free", state: 'locked' },
  { Icon: ChartBarIcon, title: 'Scenario Simulator', desc: 'What if you got a raise? Cut DoorDash? Find out instantly', state: 'soon' },
];

// Cell state: true = included, false = not included, 'soon' = built but not shipped yet.
// No "Free" column — after the 3-day access it's a hard paywall (no permanent free tier).
type CompareCell = boolean | 'soon';
const COMPARE: { feature: string; ap: CompareCell; dd: CompareCell }[] = [
  { feature: 'AI Roast & Health Score', ap: true, dd: true },
  { feature: '90-Day Step-by-Step Plan', ap: true, dd: true },
  { feature: 'Weekly Goals with Dollar Amounts', ap: true, dd: true },
  { feature: 'Subscription Audit', ap: true, dd: true },
  { feature: 'Prioritized Fix List', ap: true, dd: true },
  { feature: 'Scenario Simulator', ap: false, dd: 'soon' },
  { feature: 'Debt Payoff Planner', ap: false, dd: true },
  { feature: 'Downloadable PDF Report', ap: false, dd: true },
];

function CompareMark({ v }: { v: CompareCell }) {
  if (v === 'soon') return <Text style={[styles.compareCheck, styles.checkSoon]}>Soon</Text>;
  return (
    <Text style={[styles.compareCheck, v ? styles.checkYes : styles.checkNo]}>{v ? '✓' : '—'}</Text>
  );
}

export default function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<'action_plan' | 'deep_dive'>('deep_dive');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [processing, setProcessing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { animatedStyle } = useEntryAnimation();
  const { user } = useAuth();
  const { refresh, tier: owned } = useSubscription();

  useEffect(() => {
    trackPaywallViewed(selected);
  }, [selected]);

  useEffect(() => {
    getCurrentOffering().then(setOffering);
  }, []);

  const product = PURCHASE_PRODUCTS[selected];
  const actionPlan = PURCHASE_PRODUCTS.action_plan!;
  const deepDive = PURCHASE_PRODUCTS.deep_dive!;

  // The CTA reflects what the user already owns. Deep Dive supersedes Action Plan,
  // so on Deep Dive the Action Plan option is a no-op (disabled). No trial — new
  // users get 3 days of free access automatically; this is the plain subscribe.
  const cta = (() => {
    if (owned === selected) return { label: 'Current Plan', disabled: true };
    if (owned === 'deep_dive') return { label: 'Included in Deep Dive', disabled: true };
    if (owned === 'action_plan' && selected === 'deep_dive') return { label: 'Upgrade to Deep Dive', disabled: false };
    return { label: `Unlock ${product?.label ?? 'plan'}`, disabled: false };
  })();

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
      <PressableScale onPress={() => navigation.goBack()} haptic="light" style={styles.closeBtn}>
        <XMarkIcon size={22} color={Colors.textSecondary} />
      </PressableScale>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.heroIcon}>
            <SparklesIcon size={30} color={Colors.onAccent} />
          </LinearGradient>
          <Text style={styles.heroTitle}>Your financial wake-up call is ready.</Text>
          <Text style={styles.heroSub}>
            You've seen the score. Now get the exact roadmap to fix it — before another paycheck disappears.
          </Text>
          <View style={styles.heroUrgency}>
            <View style={styles.heroUrgencyDot} />
            <Text style={styles.heroUrgencyText}>Cancel anytime · Auto-renews monthly</Text>
          </View>
        </View>

        {/* 3-day free access — honest about the limit (no permanent free tier) */}
        <View style={styles.trialBox}>
          <Text style={styles.trialTitle}>3 days free, then choose a plan</Text>
          <Text style={styles.trialBody}>
            New users get full access to everything for 3 days. After that, Action Plan or Deep Dive
            keeps your roasts, plan & tools.
          </Text>
        </View>

        {/* Preview locked content — consistent elevated cards (no per-card neon) */}
        <SectionLabel>Preview What's Inside</SectionLabel>
        <View style={styles.previewList}>
          {PREVIEW.map(({ Icon, title, desc, state }) => (
            <View key={title} style={styles.previewCard}>
              <View style={styles.previewBadge}>
                <Icon size={20} color={Colors.accent} />
              </View>
              <View style={styles.previewContent}>
                <Text style={styles.previewTitle}>{title}</Text>
                <Text style={styles.previewDesc}>{desc}</Text>
              </View>
              {state === 'soon' ? (
                <View style={styles.previewSoon}><Text style={styles.previewSoonText}>SOON</Text></View>
              ) : (
                <View style={styles.previewLock}><LockClosedIcon size={15} color={Colors.textMuted} /></View>
              )}
            </View>
          ))}
        </View>

        {/* Product picker */}
        <SectionLabel>Choose Your Plan</SectionLabel>
        <View style={styles.planRow}>
          <PressableScale
            style={[styles.planCard, selected === 'action_plan' && styles.planCardActive]}
            onPress={() => setSelected('action_plan')}
            haptic="light"
          >
            {owned === 'action_plan' && (
              <View style={styles.planBadge}><Text style={styles.planBadgeText}>CURRENT</Text></View>
            )}
            <Text style={styles.planName}>{actionPlan.label}</Text>
            <Text style={styles.planPrice}>{priceLabel('action_plan', actionPlan.price)}</Text>
            <Text style={styles.planDesc}>per month</Text>
          </PressableScale>

          <PressableScale
            style={[styles.planCard, styles.planCardFeatured, selected === 'deep_dive' && styles.planCardActive]}
            onPress={() => setSelected('deep_dive')}
            haptic="light"
          >
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{owned === 'deep_dive' ? 'CURRENT' : 'BEST VALUE'}</Text>
            </View>
            <Text style={styles.planName}>{deepDive.label}</Text>
            <Text style={styles.planPrice}>{priceLabel('deep_dive', deepDive.price)}</Text>
            <Text style={styles.planDesc}>per month</Text>
          </PressableScale>
        </View>

        {/* Feature comparison */}
        <SectionLabel>What's Included</SectionLabel>
        <View style={styles.compareGroup}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareHeaderFeature}>Feature</Text>
            <Text style={[styles.compareHeaderTier, selected === 'action_plan' && styles.compareHeaderTierActive]}>{'Action\nPlan'}</Text>
            <Text style={[styles.compareHeaderTier, selected === 'deep_dive' && styles.compareHeaderTierActive]}>{'Deep\nDive'}</Text>
          </View>
          {COMPARE.map((row, i) => (
            <React.Fragment key={row.feature}>
              {i > 0 && <View style={styles.compareSep} />}
              <View style={styles.compareRow}>
                <Text style={styles.compareFeature}>{row.feature}</Text>
                <CompareMark v={row.ap} />
                <CompareMark v={row.dd} />
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Selected plan, right at the tap point so the choice is unambiguous. */}
        {product && !cta.disabled && (
          <Text style={styles.ctaSummary}>
            {product.label} · <Text style={styles.ctaSummaryPrice}>{priceLabel(selected, product.price)}/mo</Text>
          </Text>
        )}
        {product && (
          <NeonButton
            label={processing ? '' : cta.label}
            onPress={handleSubscribe}
            loading={processing}
            disabled={cta.disabled}
            style={styles.cta}
          />
        )}

        <PressableScale onPress={handleRestore} disabled={restoring} haptic="light" style={styles.restoreBtn}>
          <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
        </PressableScale>

        <Text style={styles.legal}>
          {product!.label} is {priceLabel(selected, product!.price)}/month. Auto-renews monthly;
          cancel anytime in your App Store settings. Payment is charged to your Apple ID.
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
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  hero: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.xs },
  heroIcon: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  heroTitle: {
    ...Typography.screenTitle,
    fontFamily: Typography.fonts.heading,
    color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm,
  },
  heroSub: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, textAlign: 'center', maxWidth: 300, lineHeight: 22 },
  heroUrgency: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  heroUrgencyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  heroUrgencyText: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted },
  previewList: { gap: Spacing.sm, marginBottom: Spacing.xl },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  previewBadge: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.accentContainer, alignItems: 'center', justifyContent: 'center',
  },
  previewContent: { flex: 1 },
  previewTitle: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  previewDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 1 },
  previewLock: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  previewSoon: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs - 1, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.warning,
  },
  previewSoonText: { fontFamily: Typography.fonts.bodySemi, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: Colors.warning },
  trialBox: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  trialTitle: { fontFamily: Typography.fonts.heading, fontSize: Typography.callout.fontSize, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.xs },
  trialBody: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, lineHeight: 18 },
  planRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  planCard: {
    flex: 1, backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1.5, borderColor: Colors.glassBorderLight,
    alignItems: 'center', gap: Spacing.xs,
    position: 'relative',
  },
  planCardFeatured: { borderColor: Colors.primary, borderWidth: 1.5 },
  planCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  planBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs - 1, marginBottom: Spacing.xs,
  },
  planBadgeText: { fontFamily: Typography.fonts.bodySemi, fontSize: 9, color: Colors.onAccent, fontWeight: '700', letterSpacing: 0.5 },
  planName: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textSecondary },
  planPrice: { fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize, fontWeight: '700', color: Colors.textPrimary },
  planDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  compareGroup: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xl,
  },
  compareHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.accentContainer },
  compareHeaderFeature: { flex: 2.5, fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  compareHeaderTier: { flex: 1, textAlign: 'center', fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  compareHeaderTierActive: { color: Colors.accent },
  compareSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.md },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, minHeight: 40 },
  compareFeature: { flex: 2.5, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  compareCheck: { flex: 1, textAlign: 'center', fontSize: Typography.subhead.fontSize, fontWeight: '600' },
  checkYes: { color: Colors.success },
  checkNo: { color: Colors.textMuted },
  checkSoon: { color: Colors.warning, fontSize: Typography.caption2.fontSize, fontWeight: '700' },
  ctaSummary: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  ctaSummaryPrice: { fontFamily: Typography.fonts.bodySemi, color: Colors.textPrimary, fontWeight: '600' },
  cta: { marginBottom: Spacing.sm },
  restoreBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  restoreText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textDecorationLine: 'underline' },
  legal: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
});
