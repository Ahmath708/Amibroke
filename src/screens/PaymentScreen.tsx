import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, PURCHASE_PRODUCTS } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import { getSupabase } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import { trackPurchaseInitiated, trackPurchaseCompleted, trackPurchaseFailed } from '@/services/analytics';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Payment'>;
  route: RouteProp<RootStackParamList, 'Payment'>;
};

export default function PaymentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { product } = route.params;
  const [paymentMethod, setPaymentMethod] = useState<'apple_pay' | 'card'>('apple_pay');
  const [processing, setProcessing] = useState(false);
  const info = PURCHASE_PRODUCTS[product];
  const { animatedStyle } = useEntryAnimation();

  const handlePay = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to complete your purchase.');
      navigation.navigate('Login');
      return;
    }
    setProcessing(true);
    await trackPurchaseInitiated(product, info!.price);

    try {
      const client = getSupabase();
      if (!client) throw new Error('Backend not configured');

      const { data, error } = await client.functions.invoke('create-checkout-session', {
        body: { plan: product },
      });

      if (error || !data?.url) {
        await trackPurchaseFailed(product, 'checkout_session_failed');
        Alert.alert('Payment Error', 'Could not start checkout. Please try again.');
        setProcessing(false);
        return;
      }

      await trackPurchaseCompleted(product, info!.price);
      Alert.alert('Checkout Started', 'Complete your subscription via the browser.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    } catch (e) {
      await trackPurchaseFailed(product, 'exception');
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!info) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="paywall" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Order Summary</Text>
        <View style={styles.orderGroup}>
          <View style={styles.orderRow}>
            <Text style={styles.orderIcon}>{product === 'deep_dive' ? '🏊' : '🎯'}</Text>
            <View style={styles.orderInfo}>
              <Text style={styles.orderTitle}>{info.label}</Text>
              <Text style={styles.orderDesc}>{info.description}</Text>
            </View>
            <Text style={styles.orderPrice}>${info.price.toFixed(2)}</Text>
          </View>
          <View style={styles.orderSep} />
          <View style={styles.orderTotalRow}>
            <Text style={styles.orderTotalLabel}>Total</Text>
            <Text style={styles.orderTotal}>${info.price.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.methodGroup}>
          <TouchableOpacity
            style={[styles.methodRow, paymentMethod === 'apple_pay' && styles.methodRowActive]}
            onPress={() => setPaymentMethod('apple_pay')}
            activeOpacity={0.7}
          >
            <Text style={styles.methodIcon}>🍎</Text>
            <Text style={styles.methodLabel}>Apple Pay</Text>
            <View style={[styles.radio, paymentMethod === 'apple_pay' && styles.radioActive]}>
              {paymentMethod === 'apple_pay' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
          <View style={styles.orderSep} />
          <TouchableOpacity
            style={[styles.methodRow, paymentMethod === 'card' && styles.methodRowActive]}
            onPress={() => setPaymentMethod('card')}
            activeOpacity={0.7}
          >
            <Text style={styles.methodIcon}>💳</Text>
            <Text style={styles.methodLabel}>Credit / Debit Card</Text>
            <View style={[styles.radio, paymentMethod === 'card' && styles.radioActive]}>
              {paymentMethod === 'card' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        </View>

        {paymentMethod === 'card' && (
          <View style={styles.cardForm}>
            <View style={styles.cardField}>
              <Text style={styles.cardFieldLabel}>Card Number</Text>
              <View style={styles.cardFieldInput}>
                <Text style={styles.cardFieldPlaceholder}>4242 4242 4242 4242</Text>
              </View>
            </View>
            <View style={styles.cardRow}>
              <View style={[styles.cardField, { flex: 1 }]}>
                <Text style={styles.cardFieldLabel}>Expiry</Text>
                <View style={styles.cardFieldInput}>
                  <Text style={styles.cardFieldPlaceholder}>MM / YY</Text>
                </View>
              </View>
              <View style={[styles.cardField, { flex: 1 }]}>
                <Text style={styles.cardFieldLabel}>CVC</Text>
                <View style={styles.cardFieldInput}>
                  <Text style={styles.cardFieldPlaceholder}>123</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {paymentMethod === 'apple_pay' ? (
          <TouchableOpacity style={styles.applePayBtn} onPress={handlePay} disabled={processing} activeOpacity={0.85}>
            {processing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.applePayText}> Pay ${info.price.toFixed(2)}</Text>
            }
          </TouchableOpacity>
        ) : (
          <NeonButton
            label={processing ? '' : `Pay $${info.price.toFixed(2)}`}
            onPress={handlePay}
            loading={processing}
            style={styles.payBtn}
          />
        )}

        <Text style={styles.secureNote}>🔒 Secured by Stripe · SSL encrypted</Text>
        <Text style={styles.legal}>
          Subscription billed monthly. Cancel anytime. 7-day free trial.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  orderGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: Spacing.xxl,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  orderIcon: { fontSize: 24 },
  orderInfo: { flex: 1 },
  orderTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  orderDesc: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, marginTop: 2 },
  orderPrice: { fontFamily: Typography.fonts.heading, fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  orderSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.lg },
  orderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 13 },
  orderTotalLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '600' },
  orderTotal: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.primary },
  methodGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: Spacing.xxl,
  },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md, minHeight: 52 },
  methodRowActive: { backgroundColor: Colors.primaryContainer },
  methodIcon: { fontSize: Typography.title3.fontSize },
  methodLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  applePayBtn: {
    backgroundColor: '#000', borderRadius: Radius.xl, height: 56,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  applePayText: { fontSize: Typography.title2.fontSize, color: '#fff', fontWeight: '600' },
  payBtn: { marginBottom: Spacing.md },
  cardForm: { backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: Spacing.xxl, gap: Spacing.md },
  cardField: { gap: Spacing.xs },
  cardFieldLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary },
  cardFieldInput: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.glassBorder },
  cardFieldPlaceholder: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textMuted },
  cardRow: { flexDirection: 'row', gap: Spacing.md },
  secureNote: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  legal: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
});
