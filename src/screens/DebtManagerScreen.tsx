import React, { useCallback, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import ReAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronRightIcon, CreditCardIcon, TruckIcon, HomeIcon, AcademicCapIcon, HeartIcon, BanknotesIcon,
} from 'react-native-heroicons/solid';
import PlusGlyph from '@/components/PlusGlyph';
import { enterUp } from '@/components/motion';
import SwipeToDelete from '@/components/SwipeToDelete';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import { getDebts, upsertDebt, deleteDebt } from '@/services/debts';
import { isPayoffDebt, type DebtRecord, type DebtKind } from '@shared/financialSnapshot';
import ScreenBackground from '@/components/ScreenBackground';
import Skeleton from '@/components/Skeleton';
import BottomSheet from '@/components/BottomSheet';
import ConfirmSheet from '@/components/ConfirmSheet';
import AppTextInput from '@/components/AppTextInput';
import DecimalInput from '@/components/DecimalInput';
import SelectableChip from '@/components/SelectableChip';
import NeonButton from '@/components/NeonButton';
import EmptyAddButton from '@/components/EmptyAddButton';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'DebtManager'> };

const KINDS: { label: string; value: DebtKind }[] = [
  { label: 'Credit card', value: 'credit_card' },
  { label: 'Student loan', value: 'student_loan' },
  { label: 'Auto', value: 'auto' },
  { label: 'Mortgage', value: 'mortgage' },
  { label: 'Medical', value: 'medical' },
  { label: 'Personal', value: 'personal' },
  { label: 'Other', value: 'other' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<DebtKind, string>;
const BAL_RANGES: [string, number][] = [['Under $5k', 2500], ['$5k–$15k', 10000], ['$15k–$50k', 30000], ['$50k+', 75000]];

function KindIcon({ kind, size, color }: { kind?: DebtKind; size: number; color: string }) {
  const Ico = kind === 'credit_card' ? CreditCardIcon
    : kind === 'auto' ? TruckIcon
    : kind === 'mortgage' ? HomeIcon
    : kind === 'student_loan' ? AcademicCapIcon
    : kind === 'medical' ? HeartIcon
    : BanknotesIcon;
  return <Ico size={size} color={color} />;
}

type Form = { id?: string; name: string; balance: string; apr: string; minPay: string; kind: DebtKind | '' };
const fmtBal = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export default function DebtManagerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [confirmDel, setConfirmDel] = useState<DebtRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const openAdd = useCallback(() => setForm({ name: '', balance: '', apr: '', minPay: '', kind: '' }), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openAdd} hitSlop={10} accessibilityLabel="Add debt" style={styles.headerAdd}>
          <PlusGlyph size={20} color={Colors.accentSolid} strokeWidth={2.4} style={styles.plusGlyph} />
        </Pressable>
      ),
    });
  }, [navigation, openAdd]);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try { setDebts(await getDebts(user.id)); } catch { /* keep */ } finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = (d: DebtRecord) => setForm({
    id: d.id, name: d.name, balance: String(Math.round(d.balance)),
    apr: d.apr != null ? String(+(d.apr * 100).toFixed(2)) : '', minPay: d.min_payment != null ? String(Math.round(d.min_payment)) : '',
    kind: d.kind ?? '',
  });

  const valid = !!form && form.name.trim().length > 0 && parseFloat(form.balance) > 0 && form.kind !== '';

  const save = useCallback(async () => {
    if (!user || !form || !valid || busy) return;
    setBusy(true);
    try {
      const next = await upsertDebt(user.id, {
        id: form.id,
        name: form.name.trim(),
        balance: Math.round(parseFloat(form.balance)),
        apr: form.apr ? Math.max(0, parseFloat(form.apr)) / 100 : undefined,
        min_payment: form.minPay ? Math.round(parseFloat(form.minPay)) : undefined,
        kind: (form.kind || undefined) as DebtKind | undefined,
      });
      setDebts(next);
      setForm(null);
    } finally {
      setBusy(false);
    }
  }, [user, form, valid, busy]);

  const doDelete = useCallback(async () => {
    if (!user || !confirmDel?.id || busy) return;
    setBusy(true);
    try {
      const next = await deleteDebt(user.id, confirmDel.id);
      setDebts(next);
      setConfirmDel(null);
      setForm(null);
    } finally {
      setBusy(false);
    }
  }, [user, confirmDel, busy]);

  const active = debts.filter((d) => d.deletedAt == null);
  const sorted = [...active].sort((a, b) => b.balance - a.balance);
  const totalDebt = active.filter(isPayoffDebt).reduce((a, d) => a + d.balance, 0);
  const totalMin = active.reduce((a, d) => a + (d.min_payment ?? 0), 0);

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>
            <Skeleton width="100%" height={140} radius={24} style={{ marginBottom: Spacing.xl }} />
            <Skeleton width="100%" height={70} radius={16} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={70} radius={16} />
          </>
        ) : active.length === 0 ? (
          <ReAnimated.View entering={enterUp(0)} style={styles.empty}>
            <View style={styles.emptyIco}><BanknotesIcon size={26} color={Colors.accentSolid} /></View>
            <Text style={styles.emptyTitle}>No debts yet</Text>
            <Text style={styles.emptyNote}>Nothing here yet — add a debt, or your next roast will fill this in.</Text>
            <EmptyAddButton label="Add your first debt" onPress={openAdd} style={{ marginTop: Spacing.lg }} />
          </ReAnimated.View>
        ) : (
          <>
            <ReAnimated.View entering={enterUp(0)} style={styles.hero}>
              <Text style={styles.heroLabel}>Total debt</Text>
              <Text style={styles.heroNum}>{fmtBal(totalDebt)}</Text>
              <Text style={styles.heroSec}><Text style={styles.heroSecB}>{active.length} debt{active.length !== 1 ? 's' : ''}</Text> · ${totalMin}/mo minimum</Text>
            </ReAnimated.View>

            <View style={styles.secLabel}><Text style={styles.secLabelText}>Your debts</Text><Text style={styles.secLabelSub}>{active.length} total</Text></View>
            <View style={styles.list}>
              {sorted.map((d, i) => (
                <ReAnimated.View key={d.id ?? d.name} entering={enterUp(i + 1)}>
                  <SwipeToDelete radius={Radius.xl} onPress={() => openEdit(d)} onDelete={() => setConfirmDel(d)} accessibilityLabel={`Delete ${d.name}`}>
                    <View style={styles.row}>
                      <View style={styles.rowIco}><KindIcon kind={d.kind} size={20} color={Colors.textSecondary} /></View>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName} numberOfLines={1}>{d.name}</Text>
                        <Text style={styles.rowMeta}>{d.kind ? KIND_LABEL[d.kind] : 'Debt'}{d.apr != null ? ` · ${(d.apr * 100).toFixed(1)}% APR` : ''}</Text>
                      </View>
                      <View style={styles.rowCost}>
                        <Text style={styles.rowBal}>{fmtBal(d.balance)}</Text>
                        {d.min_payment != null && <Text style={styles.rowMin}>${Math.round(d.min_payment)}/mo min</Text>}
                      </View>
                      <ChevronRightIcon size={18} color={Colors.textTertiary} />
                    </View>
                  </SwipeToDelete>
                </ReAnimated.View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* add / edit sheet */}
      <BottomSheet visible={form != null} onClose={() => setForm(null)} title={form?.id ? 'Edit debt' : 'Add debt'}>
        {form && (
          <View>
            <Text style={styles.fieldLabel}>Name</Text>
            <AppTextInput style={styles.textField} placeholder="e.g. Car Loan" value={form.name} onChangeText={(t: string) => setForm({ ...form, name: t })} />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Balance</Text>
            <DecimalInput value={form.balance} onChangeValue={(v) => setForm({ ...form, balance: v })} prefix="$" placeholder="0" />
            <View style={styles.chips}>
              {BAL_RANGES.map(([label, val]) => (
                <SelectableChip key={label} label={label} active={Number(form.balance) === val} onPress={() => setForm({ ...form, balance: String(val) })} />
              ))}
            </View>

            <Text style={[styles.fieldLabel, styles.fieldGap]}>APR (%)</Text>
            <DecimalInput value={form.apr} onChangeValue={(v) => setForm({ ...form, apr: v })} suffix="%" placeholder="0.0" />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Minimum payment</Text>
            <DecimalInput value={form.minPay} onChangeValue={(v) => setForm({ ...form, minPay: v })} prefix="$" placeholder="0" />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Kind</Text>
            <View style={styles.chips}>
              {KINDS.map((k) => (
                <SelectableChip key={k.value} label={k.label} active={form.kind === k.value} onPress={() => setForm({ ...form, kind: k.value })} />
              ))}
            </View>

            <View style={styles.actions}>
              {form.id && <NeonButton label="Delete" variant="danger" onPress={() => setConfirmDel({ id: form.id, name: form.name } as DebtRecord)} style={styles.deleteBtn} />}
              <NeonButton label={form.id ? 'Save changes' : 'Add debt'} onPress={save} disabled={!valid} loading={busy} style={styles.saveBtn} />
            </View>
          </View>
        )}
      </BottomSheet>

      <ConfirmSheet
        visible={confirmDel != null}
        onClose={() => setConfirmDel(null)}
        title={`Delete ${confirmDel?.name ?? 'this debt'}?`}
        message="This removes it from your debts. You can always add it back later."
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
  heroNum: { fontFamily: Typography.fonts.extrabold, fontSize: 48, letterSpacing: -2, color: Colors.textPrimary, marginTop: 10 },
  heroSec: { fontFamily: Typography.fonts.mono, fontSize: 14, color: Colors.textSecondary, marginTop: 11 },
  heroSecB: { color: Colors.textPrimary },

  secLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, marginBottom: Spacing.md, marginHorizontal: 2 },
  secLabelText: { fontFamily: Typography.fonts.bodySemi, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.textTertiary },
  secLabelSub: { fontFamily: Typography.fonts.mono, fontSize: 12, color: 'rgba(255,255,255,0.28)' },

  list: { gap: 10 },
  row: { ...card, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15 },
  rowIco: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.2 },
  rowMeta: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  rowCost: { alignItems: 'flex-end' },
  rowBal: { fontFamily: Typography.fonts.monoSemi, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.5 },
  rowMin: { fontFamily: Typography.fonts.mono, fontSize: 10.5, color: Colors.textTertiary, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.lg },
  emptyIco: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentContainer, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.accentBorder, marginBottom: 12 },
  emptyTitle: { fontFamily: Typography.fonts.extrabold, fontSize: 19, letterSpacing: -0.5, color: Colors.textPrimary },
  emptyNote: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 280 },

  // sheet form
  fieldLabel: { fontFamily: Typography.fonts.bodySemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: Colors.textTertiary, marginBottom: 9 },
  fieldGap: { marginTop: Spacing.lg },
  textField: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, paddingVertical: 14, paddingHorizontal: 15, color: Colors.textPrimary, fontFamily: Typography.fonts.bodySemi, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.xl },
  deleteBtn: { flexShrink: 0, paddingHorizontal: 18 },
  saveBtn: { flex: 1 },
});
