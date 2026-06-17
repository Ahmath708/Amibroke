import React, { useCallback, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRightIcon, ShoppingBagIcon } from 'react-native-heroicons/solid';
import PlusGlyph from '@/components/PlusGlyph';
import { enterUp } from '@/components/motion';
import SwipeToDelete from '@/components/SwipeToDelete';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import { getSpending, upsertSpending, deleteSpending } from '@/services/spending';
import type { SpendingItem } from '@shared/spending';
import { getSnapshot } from '@/services/financialSnapshot';
import ScreenBackground from '@/components/ScreenBackground';
import Skeleton from '@/components/Skeleton';
import BottomSheet from '@/components/BottomSheet';
import ConfirmSheet from '@/components/ConfirmSheet';
import AppTextInput from '@/components/AppTextInput';
import DecimalInput from '@/components/DecimalInput';
import NeonButton from '@/components/NeonButton';
import EmptyAddButton from '@/components/EmptyAddButton';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'SpendingEditor'> };
type Form = { id?: string; name: string; amt: string };
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export default function SpendingEditorScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState<SpendingItem[]>([]);
  const [expenses, setExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [confirmDel, setConfirmDel] = useState<SpendingItem | null>(null);
  const [busy, setBusy] = useState(false);

  const openAdd = useCallback(() => setForm({ name: '', amt: '' }), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openAdd} hitSlop={10} accessibilityLabel="Add category" style={styles.headerAdd}>
          <PlusGlyph size={20} color={Colors.accentSolid} strokeWidth={2.4} style={styles.plusGlyph} />
        </Pressable>
      ),
    });
  }, [navigation, openAdd]);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [spend, snap] = await Promise.all([getSpending(user.id), getSnapshot(user.id)]);
      setItems(spend ?? []);
      setExpenses(snap?.monthlyExpenses?.value ?? 0);
    } catch { /* keep */ } finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = (c: SpendingItem) => setForm({ id: c.id, name: c.category, amt: String(Math.round(c.amount)) });
  const valid = !!form && form.name.trim().length > 0 && parseFloat(form.amt) > 0;

  const save = useCallback(async () => {
    if (!user || !form || !valid || busy) return;
    setBusy(true);
    try {
      const next = await upsertSpending(user.id, { id: form.id, category: form.name.trim(), amount: Math.round(parseFloat(form.amt)) });
      setItems(next);
      setForm(null);
    } finally { setBusy(false); }
  }, [user, form, valid, busy]);

  const doDelete = useCallback(async () => {
    if (!user || !confirmDel?.id || busy) return;
    setBusy(true);
    try {
      const next = await deleteSpending(user.id, confirmDel.id);
      setItems(next);
      setConfirmDel(null);
      setForm(null);
    } finally { setBusy(false); }
  }, [user, confirmDel, busy]);

  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const named = items.reduce((a, c) => a + c.amount, 0);
  const max = sorted.length ? sorted[0].amount : 0;
  const pct = expenses > 0 ? Math.min(100, Math.round((named / expenses) * 100)) : 0;

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            <Skeleton width="100%" height={150} radius={24} style={{ marginBottom: Spacing.xl }} />
            <Skeleton width="100%" height={64} radius={16} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={64} radius={16} />
          </>
        ) : items.length === 0 ? (
          <ReAnimated.View entering={enterUp(0)} style={styles.empty}>
            <View style={styles.emptyIco}><ShoppingBagIcon size={26} color={Colors.accentSolid} /></View>
            <Text style={styles.emptyTitle}>Nothing named yet</Text>
            <Text style={styles.emptyNote}>Add a category, or your roasts will fill this in.</Text>
            <EmptyAddButton label="Add a category" onPress={openAdd} style={{ marginTop: Spacing.lg }} />
          </ReAnimated.View>
        ) : (
          <>
            <ReAnimated.View entering={enterUp(0)} style={styles.hero}>
              <Text style={styles.heroLabel}>Named spending</Text>
              <Text style={styles.heroNum}>{fmt(named)}<Text style={styles.heroMo}>/mo</Text></Text>
              {expenses > 0 && <Text style={styles.heroSec}>of your {fmt(expenses)}/mo spending</Text>}
              {expenses > 0 && <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${pct}%` }]} /></View>}
            </ReAnimated.View>

            <View style={styles.secLabel}><Text style={styles.secLabelText}>Your categories</Text><Text style={styles.secLabelSub}>{items.length} named</Text></View>
            <View style={styles.list}>
              {sorted.map((c, i) => (
                <ReAnimated.View key={c.id ?? c.category} entering={enterUp(i + 1)}>
                  <SwipeToDelete radius={Radius.xl} onPress={() => openEdit(c)} onDelete={() => setConfirmDel(c)} accessibilityLabel={`Delete ${c.category}`}>
                    <View style={styles.row}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName} numberOfLines={1}>{c.category}</Text>
                        <View style={styles.rowTrail}>
                          <Text style={styles.rowAmt}>{fmt(c.amount)}</Text>
                          <ChevronRightIcon size={18} color={Colors.textTertiary} />
                        </View>
                      </View>
                      <View style={styles.track}><View style={[styles.fill, { width: `${max > 0 ? Math.max(4, Math.round((c.amount / max) * 100)) : 0}%` }]} /></View>
                    </View>
                  </SwipeToDelete>
                </ReAnimated.View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <BottomSheet visible={form != null} onClose={() => setForm(null)} title={form?.id ? 'Edit category' : 'Add category'}>
        {form && (
          <View>
            <Text style={styles.fieldLabel}>Name</Text>
            <AppTextInput style={styles.textField} placeholder="e.g. Groceries" value={form.name} onChangeText={(t: string) => setForm({ ...form, name: t })} />
            <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Amount</Text>
            <DecimalInput value={form.amt} onChangeValue={(v) => setForm({ ...form, amt: v })} prefix="$" placeholder="0" />
            <View style={styles.actions}>
              {form.id && <NeonButton label="Delete" variant="danger" onPress={() => setConfirmDel({ id: form.id, category: form.name, amount: 0 })} style={styles.deleteBtn} />}
              <NeonButton label={form.id ? 'Save changes' : 'Add category'} onPress={save} disabled={!valid} loading={busy} style={styles.saveBtn} />
            </View>
          </View>
        )}
      </BottomSheet>

      <ConfirmSheet
        visible={confirmDel != null}
        onClose={() => setConfirmDel(null)}
        title={`Delete ${confirmDel?.category ?? 'this category'}?`}
        message="This removes it from your named spending. You can always add it back later."
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={doDelete}
      />
    </View>
  );
}

const card = {
  backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl,
  borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg },
  // Bare magenta "+" glyph — no fill, no border; circular bounds with the glyph absolutely centered.
  headerAdd: { width: 40, height: 40, borderRadius: 20 },
  plusGlyph: { position: 'absolute', top: '50%', left: '50%', marginTop: -10, marginLeft: -10 },

  hero: { ...card, borderRadius: 24, paddingVertical: 24, paddingHorizontal: 22, alignItems: 'center', marginBottom: Spacing.lg },
  heroLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.textTertiary },
  heroNum: { fontFamily: Typography.fonts.extrabold, fontSize: 44, letterSpacing: -2, color: Colors.textPrimary, marginTop: 10 },
  heroMo: { fontFamily: Typography.fonts.bodySemi, fontSize: 20, color: Colors.textSecondary, letterSpacing: -0.5 },
  heroSec: { fontFamily: Typography.fonts.mono, fontSize: 13, color: Colors.textSecondary, marginTop: 8 },
  heroTrack: { height: 8, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 16, width: 220 },
  heroFill: { height: '100%', borderRadius: Radius.pill, backgroundColor: Colors.accentSolid },

  secLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, marginBottom: Spacing.md, marginHorizontal: 2 },
  secLabelText: { fontFamily: Typography.fonts.bodySemi, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.textTertiary },
  secLabelSub: { fontFamily: Typography.fonts.mono, fontSize: 12, color: 'rgba(255,255,255,0.28)' },

  list: { gap: 10 },
  row: { ...card, paddingVertical: 13, paddingHorizontal: 15, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.2, flex: 1 },
  rowTrail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowAmt: { fontFamily: Typography.fonts.monoSemi, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.4 },
  track: { height: 8, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill, backgroundColor: Colors.accentSolid },

  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.lg },
  emptyIco: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentContainer, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder, marginBottom: 12 },
  emptyTitle: { fontFamily: Typography.fonts.extrabold, fontSize: 19, letterSpacing: -0.5, color: Colors.textPrimary },
  emptyNote: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 280 },

  fieldLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: Colors.textTertiary, marginBottom: 9 },
  textField: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, paddingVertical: 14, paddingHorizontal: 15, color: Colors.textPrimary, fontFamily: Typography.fonts.bodySemi, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.xl },
  deleteBtn: { flexShrink: 0, paddingHorizontal: 18 },
  saveBtn: { flex: 1 },
});
