import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NavigationAction } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';
import Skeleton from '@/components/Skeleton';
import NeonButton from '@/components/NeonButton';
import ConfirmSheet from '@/components/ConfirmSheet';
import FinancialContextForm, { ContextValues } from '@/components/FinancialContextForm';
import { getFinancialContext, saveFinancialContext } from '@/services/financialContext';
import { useAuth } from '@/context/AuthContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'FinancialContext'> };

// Life Context collects demographics only — money (income/debt/savings) lives on the Financials tab.
const LIFE_FIELDS = ['state', 'ageBracket', 'livingSituation', 'employmentStatus'];

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
        setInitial(loaded);
        setValues(loaded);
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
      // Life Context edits demographics only; money lives on the Financials tab, so this no longer
      // re-seeds the snapshot.
      if (user) await saveFinancialContext(user.id, values);
    } catch (e) {
      console.warn('[life-context] save failed:', e);
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
        // Skeleton mirrors the form (subtitle → labelled field groups) — calmer than a centered spinner.
        <View style={[styles.scroll, { paddingTop: Spacing.xl }]}>
          <Skeleton width="80%" height={18} radius={Radius.sm} style={{ marginBottom: Spacing.xl }} />
          <View style={{ gap: Spacing.xl }}>
            {Array.from({ length: LIFE_FIELDS.length }).map((_, i) => (
              <View key={i} style={{ gap: Spacing.sm }}>
                <Skeleton width="40%" height={14} radius={Radius.sm} />
                <Skeleton height={48} radius={Radius.lg} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: Spacing.xs, paddingBottom: Spacing.sm }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.subtitle}>
              Tunes your score to your actual life — not some average.
            </Text>
            <FinancialContextForm values={values} onChange={setValues} only={LIFE_FIELDS} />
          </ScrollView>

          {/* Sticky footer — Save is always reachable, and stays disabled until something changes. */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
            <NeonButton
              label="Save Changes"
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
        message="You've edited your details but haven't saved. Leaving now drops those changes."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={onDiscard}
      />
      <ConfirmSheet
        visible={saveVisible}
        onClose={() => { if (!saving) setSaveVisible(false); }}
        title="Update your context?"
        message="This refreshes the life details your score and plan are tuned to."
        confirmLabel="Save changes"
        loading={saving}
        onConfirm={doSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
