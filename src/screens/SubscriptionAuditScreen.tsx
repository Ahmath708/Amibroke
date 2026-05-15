import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';

const SUBS = [
  { id: '1', name: 'Netflix', amount: 15.99, icon: '🎬', lastUsed: '2 days ago', category: 'Entertainment', keep: true },
  { id: '2', name: 'Spotify', amount: 9.99, icon: '🎵', lastUsed: 'Today', category: 'Music', keep: true },
  { id: '3', name: 'Gym Membership', amount: 49.99, icon: '💪', lastUsed: '6 weeks ago', category: 'Health', keep: null },
  { id: '4', name: 'Adobe Creative', amount: 54.99, icon: '🎨', lastUsed: '3 months ago', category: 'Software', keep: null },
  { id: '5', name: 'LinkedIn Premium', amount: 39.99, icon: '💼', lastUsed: '1 month ago', category: 'Career', keep: null },
  { id: '6', name: 'Duolingo Plus', amount: 6.99, icon: '🦜', lastUsed: '2 months ago', category: 'Learning', keep: null },
  { id: '7', name: 'iCloud 200GB', amount: 2.99, icon: '☁️', lastUsed: 'Today', category: 'Storage', keep: true },
  { id: '8', name: 'Disney+', amount: 13.99, icon: '🏰', lastUsed: '5 weeks ago', category: 'Entertainment', keep: null },
];

export default function SubscriptionAuditScreen() {
  const insets = useSafeAreaInsets();
  const [decisions, setDecisions] = useState<Record<string, boolean | null>>(
    Object.fromEntries(SUBS.map((s) => [s.id, s.keep]))
  );

  const decide = (id: string, keep: boolean) => {
    setDecisions((prev) => ({ ...prev, [id]: prev[id] === keep ? null : keep }));
  };

  const keepCount = Object.values(decisions).filter((v) => v === true).length;
  const cutCount = Object.values(decisions).filter((v) => v === false).length;
  const totalCutSavings = SUBS.filter((s) => decisions[s.id] === false)
    .reduce((sum, s) => sum + s.amount, 0);
  const totalMonthly = SUBS.reduce((s, sub) => s + sub.amount, 0);

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${totalMonthly.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Total/mo</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>${totalCutSavings.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Could save</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>{cutCount}</Text>
            <Text style={styles.summaryLabel}>To cancel</Text>
          </View>
        </View>

        {/* Subs list */}
        <Text style={styles.sectionLabel}>Your Subscriptions · {SUBS.length} found</Text>
        <View style={styles.subGroup}>
          {SUBS.map((sub, i) => {
            const d = decisions[sub.id];
            return (
              <React.Fragment key={sub.id}>
                {i > 0 && <View style={styles.subSep} />}
                <View style={styles.subRow}>
                  <View style={styles.subIcon}>
                    <Text style={styles.subIconText}>{sub.icon}</Text>
                  </View>
                  <View style={styles.subInfo}>
                    <View style={styles.subHeader}>
                      <Text style={styles.subName}>{sub.name}</Text>
                      <Text style={styles.subAmount}>${sub.amount}/mo</Text>
                    </View>
                    <Text style={styles.subMeta}>{sub.category} · Last used: {sub.lastUsed}</Text>
                    <View style={styles.subActions}>
                      <TouchableOpacity
                        style={[styles.keepBtn, d === true && styles.keepBtnActive]}
                        onPress={() => decide(sub.id, true)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.keepBtnText, d === true && styles.keepBtnTextActive]}>Keep</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cutBtn, d === false && styles.cutBtnActive]}
                        onPress={() => decide(sub.id, false)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.cutBtnText, d === false && styles.cutBtnTextActive]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Result banner */}
        {cutCount > 0 && (
          <LinearGradient
            colors={['rgba(57,255,20,0.15)', 'rgba(0,224,255,0.12)']}
            style={styles.resultBanner}
          >
            <Text style={styles.resultTitle}>
              💰 Cutting {cutCount} sub{cutCount !== 1 ? 's' : ''} saves you{' '}
              <Text style={{ color: Colors.success }}>${totalCutSavings.toFixed(2)}/month</Text>
            </Text>
            <Text style={styles.resultSub}>
              That's ${(totalCutSavings * 12).toFixed(2)} back in your pocket every year.
            </Text>
          </LinearGradient>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 24,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: Typography.fonts.heading, fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  summaryLabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: Colors.separator },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  subGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: 20,
  },
  subSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
  subRow: { flexDirection: 'row', padding: 14, gap: 12 },
  subIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center',
  },
  subIconText: { fontSize: 20 },
  subInfo: { flex: 1, gap: 3 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  subAmount: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  subMeta: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted },
  subActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  keepBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  keepBtnActive: { backgroundColor: Colors.successContainer, borderColor: Colors.success },
  keepBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary },
  keepBtnTextActive: { color: Colors.success, fontWeight: '500' },
  cutBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  cutBtnActive: { backgroundColor: Colors.dangerContainer, borderColor: Colors.danger },
  cutBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary },
  cutBtnTextActive: { color: Colors.danger, fontWeight: '500' },
  resultBanner: {
    borderRadius: Radius.lg, padding: 16, gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  resultTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  resultSub: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
});
