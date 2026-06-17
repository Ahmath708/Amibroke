import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
} from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { ArrowPathRoundedSquareIcon } from 'react-native-heroicons/solid';
import { enterUp, PressableScale } from '@/components/motion';
import SectionLabel from '@/components/SectionLabel';
import AppTextInput from '@/components/AppTextInput';
import MoneyInput from '@/components/MoneyInput';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Subscription } from '@/types';
import { getSubscriptions, saveSubscription, deleteSubscription } from '@/services/subscriptionAudit';
import { useAuth } from '@/context/AuthContext';
import ToolSkeleton from '@/components/ToolSkeleton';
import EmptyAddButton from '@/components/EmptyAddButton';
import ConfirmSheet from '@/components/ConfirmSheet';
import { useRequireEntitlement } from '@/hooks/useRequireEntitlement';
import ScreenBackground from '@/components/ScreenBackground';
import { formatCurrency } from '@/utils/format';

const ICONS = ['🎬', '🎵', '💪', '🎨', '💼', '🦜', '☁️', '🏰', '📦', '📰', '🧘', '🍿', '📺', '🎮', '📚'];

export default function SubscriptionAuditScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { authorized } = useRequireEntitlement('action_plan');

  // All useState calls must be at top — no conditional hooks
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Record<string, boolean | null>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [delSub, setDelSub] = useState<Subscription | null>(null);
  const [delBusy, setDelBusy] = useState(false);

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
        category: '',
        billing_period: 'monthly',
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

  const doDelete = async () => {
    if (!user || !delSub) return;
    setDelBusy(true);
    try {
      await deleteSubscription(user.id, delSub.id);
      setDelSub(null);
      fetchSubs();
    } catch {
      Alert.alert('Error', 'Failed to delete subscription.');
    } finally {
      setDelBusy(false);
    }
  };

  if (loading) return <ToolSkeleton variant="subscriptions" heroHeight={96} rows={3} rowHeight={64} />;
  if (!authorized) return null;

  const cutCount = Object.values(decisions).filter((v) => v === false).length;
  const totalCutSavings = subs.filter((s) => decisions[s.id] === false)
    .reduce((sum, s) => sum + s.amount, 0);
  const totalMonthly = subs.reduce((s, sub) => s + sub.amount, 0);

  return (
    <ReAnimated.View entering={enterUp(0)} style={styles.container}>
      <ScreenBackground variant="subscriptions" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        {subs.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatCurrency(totalMonthly, 2)}</Text>
              <Text style={styles.summaryLabel}>Total/mo</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatCurrency(totalCutSavings, 2)}</Text>
              <Text style={styles.summaryLabel}>Could save</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.danger }]}>{cutCount}</Text>
              <Text style={styles.summaryLabel}>To cancel</Text>
            </View>
          </View>
        )}

        {subs.length === 0 && !showAdd && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIco}><ArrowPathRoundedSquareIcon size={26} color={Colors.accentSolid} /></View>
            <Text style={styles.emptyTitle}>No subscriptions yet</Text>
            <Text style={styles.emptyNote}>Add your recurring charges to see the real monthly damage.</Text>
            <EmptyAddButton label="Add your first subscription" onPress={() => setShowAdd(true)} style={{ marginTop: Spacing.lg }} />
          </View>
        )}
        {subs.length > 0 && (
          <>
            <SectionLabel>Your Subscriptions · {subs.length} found</SectionLabel>
            <View style={styles.subGroup}>
              {subs.map((sub, i) => {
                const d = decisions[sub.id];
                return (
                  <React.Fragment key={sub.id}>
                    {i > 0 && <View style={styles.subSep} />}
                    <View style={styles.subRow}>
                      <PressableScale onPress={() => setDelSub(sub)} style={styles.subIcon}>
                        <Text style={styles.subIconText}>{ICONS[i % ICONS.length]}</Text>
                      </PressableScale>
                      <View style={styles.subInfo}>
                        <View style={styles.subHeader}>
                          <Text style={styles.subName}>{sub.name}</Text>
                          <Text style={styles.subAmount}>{formatCurrency(sub.amount, 2)}/mo</Text>
                        </View>
                        <Text style={styles.subMeta}>{sub.category}{sub.last_used ? ` · Last used: ${sub.last_used}` : ''}</Text>
                        <View style={styles.subActions}>
                          <PressableScale
                            style={[styles.keepBtn, d === true && styles.keepBtnActive]}
                            onPress={() => decide(sub.id, true)}
                          >
                            <Text style={[styles.keepBtnText, d === true && styles.keepBtnTextActive]}>Keep</Text>
                          </PressableScale>
                          <PressableScale
                            style={[styles.cutBtn, d === false && styles.cutBtnActive]}
                            onPress={() => decide(sub.id, false)}
                          >
                            <Text style={[styles.cutBtnText, d === false && styles.cutBtnTextActive]}>Cancel</Text>
                          </PressableScale>
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
            <MoneyInput
              value={newAmount}
              onChangeValue={setNewAmount}
              placeholder="Monthly amount"
              containerStyle={styles.amountField}
            />
            <View style={styles.addActions}>
              <PressableScale onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </PressableScale>
              <PressableScale onPress={handleAdd} style={styles.addBtn}>
                <Text style={styles.addBtnText}>Add Subscription</Text>
              </PressableScale>
            </View>
          </View>
        ) : subs.length > 0 ? (
          <PressableScale style={styles.addRow} onPress={() => setShowAdd(true)}>
            <Text style={styles.addRowText}>+ Add Subscription</Text>
          </PressableScale>
        ) : null}

        {/* Result banner */}
        {cutCount > 0 && (
          <LinearGradient
            colors={['rgba(57,255,20,0.15)', 'rgba(0,224,255,0.12)']}
            style={styles.resultBanner}
          >
            <Text style={styles.resultTitle}>
              💰 Cutting {cutCount} sub{cutCount !== 1 ? 's' : ''} saves you{' '}
              <Text style={{ color: Colors.success }}>{formatCurrency(totalCutSavings, 2)}/month</Text>
            </Text>
            <Text style={styles.resultSub}>
              That's {formatCurrency(totalCutSavings * 12, 2)} back in your pocket every year.
            </Text>
          </LinearGradient>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={delSub != null}
        onClose={() => setDelSub(null)}
        title={`Delete ${delSub?.name ?? 'this subscription'}?`}
        message="This removes it from your subscriptions. You can always add it back later."
        confirmLabel="Delete"
        destructive
        loading={delBusy}
        onConfirm={doDelete}
      />
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  // Claude-Design empty state (matches the Debt / Spending managers)
  emptyWrap: { alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.lg },
  emptyIco: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentContainer, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder, marginBottom: 12 },
  emptyTitle: { fontFamily: Typography.fonts.extrabold, fontSize: 19, letterSpacing: -0.5, color: Colors.textPrimary },
  emptyNote: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 280 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    marginBottom: Spacing.xxl,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: Typography.fonts.heading, fontSize: Typography.title3.fontSize, fontWeight: '700', color: Colors.textPrimary },
  summaryLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: Colors.separator },
  subGroup: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
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
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  keepBtnActive: { backgroundColor: Colors.successContainer, borderColor: Colors.success },
  keepBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary },
  keepBtnTextActive: { color: Colors.success, fontWeight: '500' },
  cutBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
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
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight, gap: 10,
  },
  addInput: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary,
    backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, padding: Spacing.md,
  },
  amountField: { backgroundColor: Colors.backgroundSecondary, borderWidth: 0 },
  addActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.xs },
  cancelBtn: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  addBtn: {
    backgroundColor: Colors.accentContainer, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  addBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.accent, fontWeight: '600' },
  addRow: {
    alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.lg,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight, borderStyle: 'dashed',
  },
  addRowText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.accent, fontWeight: '500' },
});
