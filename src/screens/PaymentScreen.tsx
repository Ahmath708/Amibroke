import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, PURCHASE_PRODUCTS } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import { createPaymentIntent, confirmPurchase } from '@/services/stripe';
import { useAuth } from '@/context/AuthContext';
import { trackPurchaseInitiated, trackPurchaseCompleted, trackPurchaseFailed } from '@/services/analytics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Payment'>;
  route: RouteProp<RootStackParamList, 'Payment'>;
};

export default function PaymentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { product } = route.params;
  const [processing, setProcessing] = useState(false);
  const info = PURCHASE_PRODUCTS[product];

  const handlePay = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please create an account to complete your purchase.');
      navigation.navigate('Login');
      return;
    }

    setProcessing(true);
    await trackPurchaseInitiated(product, info!.price);

    try {
      const paymentIntent = await createPaymentIntent(user.id, product);

      if (!paymentIntent) {
        await trackPurchaseFailed(product, 'payment_intent_failed');
        Alert.alert('Payment Error', 'Could not initialize payment. Please try again.');
        setProcessing(false);
        return;
      }

      const confirmed = await confirmPurchase(paymentIntent.paymentIntentId, product);

      if (confirmed) {
        await trackPurchaseCompleted(product, info!.price);
        Alert.alert('Purchase Complete!', `You now have access to the ${info!.label}.`);
        navigation.navigate('Home');
      } else {
        await trackPurchaseFailed(product, 'payment_not_succeeded');
        Alert.alert('Payment Failed', 'Your payment could not be processed. Please try again.');
      }
    } catch (e) {
      await trackPurchaseFailed(product, 'exception');
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!info) return null;

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
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
          <TouchableOpacity style={[styles.methodRow, styles.methodRowActive]} activeOpacity={0.7}>
            <Text style={styles.methodIcon}>🍎</Text>
            <Text style={styles.methodLabel}>Apple Pay</Text>
            <View style={[styles.radio, styles.radioActive]}>
              <View style={styles.radioDot} />
            </View>
          </TouchableOpacity>
          <View style={styles.orderSep} />
          <TouchableOpacity style={styles.methodRow} activeOpacity={0.7}>
            <Text style={styles.methodIcon}>💳</Text>
            <Text style={styles.methodLabel}>Credit / Debit Card</Text>
            <View style={styles.radio} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.applePayBtn} onPress={handlePay} disabled={processing} activeOpacity={0.85}>
          {processing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.applePayText}> Pay ${info.price.toFixed(2)}</Text>
          }
        </TouchableOpacity>

        <NeonButton
          label={processing ? '' : `Pay $${info.price.toFixed(2)}`}
          onPress={handlePay}
          loading={processing}
          style={styles.payBtn}
        />

        <Text style={styles.secureNote}>🔒 Secured by Stripe · SSL encrypted</Text>
        <Text style={styles.legal}>
          One-time purchase. No recurring charges. Instant access after payment.
        </Text>
      </ScrollView>
    </LinearGradient>
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
  secureNote: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  legal: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
});
