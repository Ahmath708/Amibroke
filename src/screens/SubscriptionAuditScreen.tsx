import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Animated,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Subscription } from '@/types';
import { getSubscriptions, saveSubscription, deleteSubscription } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { getSubscription, hasAccessTo } from '@/services/subscriptions';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import ScreenBackground from '@/components/ScreenBackground';

const ICONS = ['🎬', '🎵', '💪', '🎨', '💼', '🦜', '☁️', '🏰', '📦', '📰', '🧘', '🍿', '📺', '🎮', '📚'];

export default function SubscriptionAuditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();

  // All useState calls must be at top — no conditional hooks
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, boolean | null>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const { animatedStyle } = useEntryAnimation();

  useEffect(() => {
    (async () => {
      const { tier } = await getSubscription(user?.id ?? '');
      if (hasAccessTo(tier, 'action_plan')) {
        setAuthorized(true);
      } else {
        navigation.dispatch(StackActions.replace('Paywall'));
      }
      setLoading(false);
    })();
  }, []);

  const fetchSubs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSubscriptions(user.id);
      setSubs(data);
      setDecisions(Object.fromEntries(data.map((s) => [s.id, null])));
    } catch {
      console.warn('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) fetchSubs();
  }, [user, authorized]);

  const decide = (id: string, keep: boolean) => {
    setDecisions((prev) => ({ ...prev, [id]: prev[id] === keep ? null : keep }));
  };

  const handleAdd = async () => {
    if (!user || !newName.trim() || !newAmount.trim()) return;
    try {
      const id = await saveSubscription(user.id, {
        name: newName.trim(),
        amount: parseFloat(newAmount),
        icon: ICONS[subs.length % ICONS.length],
        category: '',
        last_used: '',
      });
      if (id) {
        setNewName('');
        setNewAmount('');
        setShowAdd(false);
        fetchSubs();
      }
    } catch {
      Alert.alert('Error', 'Failed to add subscription.');
    }
  };

  const handleDelete = (subId: string) => {
    if (!user) return;
    Alert.alert('Delete', 'Remove this subscription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteSubscription(user.id, subId);
            fetchSubs();
          } catch {
            Alert.alert('Error', 'Failed to delete subscription.');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingState style={{ flex: 1, paddingTop: 120 }} />;
  if (!authorized) return null;

  const keepCount = Object.values(decisions).filter((v) => v === true).length;
  const cutCount = Object.values(decisions).filter((v) => v === false).length;
  const totalCutSavings = subs.filter((s) => decisions[s.id] === false)
    .reduce((sum, s) => sum + s.amount, 0);
  const totalMonthly = subs.reduce((s, sub) => s + sub.amount, 0);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="subscriptions" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        {subs.length > 0 && (
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
        )}

        {subs.length === 0 ? (
          <EmptyState emoji="🗂️" title="No subscriptions yet" body="Add your subscriptions manually to audit your monthly spending." />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Your Subscriptions · {subs.length} found</Text>
            <View style={styles.subGroup}>
              {subs.map((sub, i) => {
                const d = decisions[sub.id];
                return (
                  <React.Fragment key={sub.id}>
                    {i > 0 && <View style={styles.subSep} />}
                    <View style={styles.subRow}>
                      <TouchableOpacity onPress={() => handleDelete(sub.id)} style={styles.subIcon}>
                        <Text style={styles.subIconText}>{sub.icon}</Text>
                      </TouchableOpacity>
                      <View style={styles.subInfo}>
                        <View style={styles.subHeader}>
                          <Text style={styles.subName}>{sub.name}</Text>
                          <Text style={styles.subAmount}>${sub.amount.toFixed(2)}/mo</Text>
                        </View>
                        <Text style={styles.subMeta}>{sub.category}{sub.last_used ? ` · Last used: ${sub.last_used}` : ''}</Text>
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
          </>
        )}

        {/* Add subscription */}
        {showAdd ? (
          <View style={styles.addCard}>
            <AppTextInput
              style={styles.addInput}
              placeholder="Subscription name"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <AppTextInput
              style={styles.addInput}
              placeholder="Monthly amount"
              placeholderTextColor={Colors.textMuted}
              value={newAmount}
              onChangeText={setNewAmount}
              keyboardType="numeric"
            />
            <View style={styles.addActions}>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAdd} style={styles.addBtn}>
                <Text style={styles.addBtnText}>Add Subscription</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addRow} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
            <Text style={styles.addRowText}>+ Add Subscription</Text>
          </TouchableOpacity>
        )}

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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.xxl,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textPrimary },
  summaryLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: Colors.separator },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  subGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
    marginBottom: Spacing.xl,
  },
  subSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
  subRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md },
  subIcon: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center',
  },
  subIconText: { fontSize: Typography.title3.fontSize },
  subInfo: { flex: 1, gap: 3 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, fontWeight: '500' },
  subAmount: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textSecondary, fontWeight: '500' },
  subMeta: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textMuted },
  subActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  keepBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  keepBtnActive: { backgroundColor: Colors.successContainer, borderColor: Colors.success },
  keepBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  keepBtnTextActive: { color: Colors.success, fontWeight: '500' },
  cutBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  cutBtnActive: { backgroundColor: Colors.dangerContainer, borderColor: Colors.danger },
  cutBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  cutBtnTextActive: { color: Colors.danger, fontWeight: '500' },
  resultBanner: {
    borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  resultTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary, lineHeight: 22 },
  resultSub: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  addCard: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, gap: 10,
  },
  addInput: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary,
    backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, padding: Spacing.md,
  },
  addActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.xs },
  cancelBtn: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  addBtn: {
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  addBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.primary, fontWeight: '600' },
  addRow: {
    alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.lg,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, borderStyle: 'dashed',
  },
  addRowText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.tint, fontWeight: '500' },
});
