import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NavigationAction } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';
import NeonButton from '@/components/NeonButton';
import ConfirmSheet from '@/components/ConfirmSheet';
import FinancialContextForm, { ContextValues, parseIncome, syncIncomeBracket } from '@/components/FinancialContextForm';
import { getFinancialContext, saveFinancialContext } from '@/services/financialContext';
import { getSnapshot, seedSnapshotFromOnboarding } from '@/services/financialSnapshot';
import { useAuth } from '@/context/AuthContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'FinancialContext'> };

/** Same non-empty entries → not dirty. Treats missing and '' as equal. */
function sameValues(a: ContextValues, b: ContextValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? '') !== (b[k] ?? '')) return false;
  return true;
}

export default function FinancialContextScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [initial, setInitial] = useState<ContextValues | null>(null);
  const [values, setValues] = useState<ContextValues>({});
  const [saving, setSaving] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);

  const dirty = useMemo(() => (initial ? !sameValues(values, initial) : false), [values, initial]);

  // Refs so the one-time beforeRemove listener always sees current state without re-subscribing.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const bypassRef = useRef(false); // set right before an intentional leave (save or confirmed discard)
  const pendingAction = useRef<NavigationAction | null>(null);

  useEffect(() => {
    if (!user) { setInitial({}); setValues({}); return; }
    (async () => {
      try {
        const loaded = await getFinancialContext(user.id);
        // Optional exact income lives on the snapshot now (stated) — prefill it if present.
        const snap = await getSnapshot(user.id);
        const inc = snap?.monthlyIncome?.value;
        if (typeof inc === 'number' && inc > 0) loaded.incomeExact = String(Math.round(inc));
        // Re-derive the bracket from that exact amount so a stale stored bracket never shows next
        // to a different exact income (the chip is just a coarse view of the exact figure). Applied
        // to both initial + values so it's a silent display fix, not a phantom unsaved change.
        const synced = syncIncomeBracket(loaded);
        setInitial(synced);
        setValues(synced);
      } catch {
        setInitial({});
        setValues({});
      }
    })();
  }, [user]);

  // Disable the swipe-back gesture while there are unsaved changes so the guard can't be bypassed.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
  }, [navigation, dirty]);

  // Guard the header back: intercept, confirm discard, then dispatch the original action.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || bypassRef.current) return;
      e.preventDefault();
      pendingAction.current = e.data.action;
      setDiscardVisible(true);
    });
  }, [navigation]);

  const onDiscard = () => {
    bypassRef.current = true;
    setDiscardVisible(false);
    if (pendingAction.current) navigation.dispatch(pendingAction.current);
  };

  const doSave = async () => {
    setSaving(true);
    try {
      if (user) {
        await saveFinancialContext(user.id, values);
        // Refresh the snapshot from the brackets (estimated) + the optional exact income (stated).
        await seedSnapshotFromOnboarding(
          user.id,
          { incomeBracket: values.incomeBracket, liquidSavingsBracket: values.liquidSavingsBracket, debtBracket: values.debtBracket },
          parseIncome(values.incomeExact),
        );
      }
    } catch (e) {
      console.warn('[financial-context] save failed:', e);
    }
    setSaving(false);
    setSaveVisible(false);
    bypassRef.current = true; // intentional leave — skip the discard guard
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      {!initial ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.accent} /></View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: Spacing.lg, paddingBottom: Spacing.xxl }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.subtitle}>
              This personalizes your score and plan against state and demographic baselines. All optional.
            </Text>
            <FinancialContextForm values={values} onChange={setValues} />
          </ScrollView>

          {/* Sticky footer — Save is always reachable, and stays disabled until something changes. */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
            <NeonButton
              label="Save"
              onPress={() => setSaveVisible(true)}
              disabled={!dirty || saving}
              loading={saving}
            />
          </View>
        </>
      )}

      <ConfirmSheet
        visible={discardVisible}
        onClose={() => setDiscardVisible(false)}
        title="Discard changes?"
        message="You've edited your numbers but haven't saved. Leaving now drops those changes."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={onDiscard}
      />
      <ConfirmSheet
        visible={saveVisible}
        onClose={() => { if (!saving) setSaveVisible(false); }}
        title="Update your numbers?"
        message="This refreshes the financial baseline your score and plan are measured against."
        confirmLabel="Save changes"
        loading={saving}
        onConfirm={doSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.xl },
  subtitle: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.xl,
  },
  footer: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator,
    backgroundColor: Colors.background,
  },
});
