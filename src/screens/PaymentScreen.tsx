import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import NeonButton from '../components/NeonButton';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Payment'> };

export default function PaymentScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<'apple' | 'card'>('apple');
  const [processing, setProcessing] = useState(false);
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      navigation.navigate('Home');
    }, 2000);
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order summary */}
        <Text style={styles.sectionLabel}>Order Summary</Text>
        <View style={styles.orderGroup}>
          <View style={styles.orderRow}>
            <Text style={styles.orderIcon}>✨</Text>
            <View style={styles.orderInfo}>
              <Text style={styles.orderTitle}>Am I Broke? Lifetime</Text>
              <Text style={styles.orderDesc}>Unlimited access, forever</Text>
            </View>
            <Text style={styles.orderPrice}>$19.99</Text>
          </View>
          <View style={styles.orderSep} />
          <View style={styles.orderTotalRow}>
            <Text style={styles.orderTotalLabel}>Total</Text>
            <Text style={styles.orderTotal}>$19.99</Text>
          </View>
        </View>

        {/* Payment method */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.methodGroup}>
          <TouchableOpacity
            style={[styles.methodRow, method === 'apple' && styles.methodRowActive]}
            onPress={() => setMethod('apple')}
            activeOpacity={0.7}
          >
            <Text style={styles.methodIcon}>🍎</Text>
            <Text style={styles.methodLabel}>Apple Pay</Text>
            <View style={[styles.radio, method === 'apple' && styles.radioActive]}>
              {method === 'apple' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
          <View style={styles.orderSep} />
          <TouchableOpacity
            style={[styles.methodRow, method === 'card' && styles.methodRowActive]}
            onPress={() => setMethod('card')}
            activeOpacity={0.7}
          >
            <Text style={styles.methodIcon}>💳</Text>
            <Text style={styles.methodLabel}>Credit / Debit Card</Text>
            <View style={[styles.radio, method === 'card' && styles.radioActive]}>
              {method === 'card' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Card form */}
        {method === 'card' && (
          <>
            <Text style={styles.sectionLabel}>Card Details</Text>
            <View style={styles.cardGroup}>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>Card Number</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="4242 4242 4242 4242"
                  placeholderTextColor={Colors.textMuted}
                  value={cardNum}
                  onChangeText={setCardNum}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              </View>
              <View style={styles.cardSep} />
              <View style={styles.cardRowSplit}>
                <View style={styles.cardCellHalf}>
                  <Text style={styles.cardLabel}>Expiry</Text>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="MM / YY"
                    placeholderTextColor={Colors.textMuted}
                    value={expiry}
                    onChangeText={setExpiry}
                    keyboardType="number-pad"
                    maxLength={7}
                  />
                </View>
                <View style={styles.cardVDivider} />
                <View style={styles.cardCellHalf}>
                  <Text style={styles.cardLabel}>CVC</Text>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="123"
                    placeholderTextColor={Colors.textMuted}
                    value={cvc}
                    onChangeText={setCvc}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>
            </View>
          </>
        )}

        {/* Pay button */}
        {method === 'apple' ? (
          <TouchableOpacity style={styles.applePayBtn} onPress={handlePay} activeOpacity={0.85}>
            {processing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.applePayText}> Pay</Text>
            }
          </TouchableOpacity>
        ) : (
          <NeonButton
            label={processing ? '' : 'Pay $19.99'}
            onPress={handlePay}
            loading={processing}
            style={styles.payBtn}
          />
        )}

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
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  orderGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 24,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  orderIcon: { fontSize: 24 },
  orderInfo: { flex: 1 },
  orderTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  orderDesc: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  orderPrice: { fontFamily: Typography.fonts.heading, fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  orderSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 16 },
  orderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  orderTotalLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  orderTotal: { fontFamily: Typography.fonts.heading, fontSize: 20, fontWeight: '700', color: Colors.primary },
  methodGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 24,
  },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, minHeight: 52 },
  methodRowActive: { backgroundColor: Colors.primaryContainer },
  methodIcon: { fontSize: 20 },
  methodLabel: { flex: 1, fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textPrimary },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  cardGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 24,
  },
  cardCell: { paddingHorizontal: 16, paddingVertical: 12 },
  cardCellHalf: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  cardLabel: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  cardInput: { fontFamily: Typography.fonts.body, fontSize: 16, color: Colors.textPrimary },
  cardSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 16 },
  cardRowSplit: { flexDirection: 'row' },
  cardVDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  applePayBtn: {
    backgroundColor: '#000', borderRadius: Radius.xl, height: 56,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  applePayText: { fontSize: 22, color: '#fff', fontWeight: '600' },
  payBtn: { marginBottom: 12 },
  secureNote: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  legal: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
});
