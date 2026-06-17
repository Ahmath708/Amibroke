import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Keyboard } from 'react-native';
import { PressableScale } from '@/components/motion';
import AppTextInput from '@/components/AppTextInput';
import BottomSheet from '@/components/BottomSheet';
import PickerField from '@/components/PickerField';
import { CheckIcon } from 'react-native-heroicons/outline';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

// 50 states + DC (matches shared/baselines/states.ts coverage).
const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

// Bounded Levenshtein distance for typo tolerance.
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

// Higher score = better match; negative = no match.
function scoreState(query: string, s: { code: string; name: string }): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = s.name.toLowerCase();
  const code = s.code.toLowerCase();
  if (code === q) return 100;
  if (code.startsWith(q) || name.startsWith(q)) return 90;
  if (name.includes(q)) return 70;
  // Typo tolerance (only for longer queries, to avoid over-matching initials).
  if (q.length >= 4) {
    const best = Math.min(editDistance(q, name), ...name.split(' ').map((w) => editDistance(q, w)));
    if (best <= 2) return 40;
  }
  return -1;
}

interface Props {
  value: string; // state code or ''
  onChange: (code: string) => void;
  /** Floating field label (default "State"). */
  label?: string;
}

export default function StateSelect({ value, onChange, label = 'State' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The keyboard overlaps the sheet (avoidKeyboard=false); pad the list by its height while typing so
  // the last rows can scroll clear, but collapse to nothing when it's down (no dead over-scroll space).
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const selected = US_STATES.find((s) => s.code === value);

  const results = useMemo(() => {
    return US_STATES
      .map((s) => ({ s, score: scoreState(query, s) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
      .map((r) => r.s);
  }, [query]);

  const close = () => { setOpen(false); setQuery(''); };
  const choose = (code: string) => { onChange(code); close(); };

  return (
    <>
      <PickerField label={label} value={selected?.name} placeholder="Choose your state" onPress={() => setOpen(true)} active={open} />

      <BottomSheet
        visible={open}
        onClose={close}
        scrollable={false}
        fitContent={false}
        heightFraction={0.8}
        dragHandleOnly
        avoidKeyboard={false} // let the keyboard overlap so a few results leak above it (search-list feel)
      >
        <AppTextInput
          style={styles.search}
          placeholder="Search states"
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <FlatList
          data={results}
          keyExtractor={(s) => s.code}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: kbHeight + Spacing.sm }]}
          ListEmptyComponent={<Text style={styles.empty}>No states match “{query}”.</Text>}
          renderItem={({ item }) => {
            const sel = item.code === value;
            return (
              <PressableScale style={[styles.row, sel && styles.rowSel]} onPress={() => choose(item.code)}>
                <Text style={[styles.rowName, sel && styles.rowNameSel]}>{item.name}</Text>
                {sel && <CheckIcon size={19} color={Colors.accentSolid} strokeWidth={2.6} />}
              </PressableScale>
            );
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 50, borderRadius: Radius.lg, backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.glassBorder, paddingHorizontal: 16, marginBottom: Spacing.md,
    fontFamily: Typography.fonts.bodyMed, fontSize: 16, color: Colors.textPrimary,
  },
  // bleed rows a touch wider than the sheet body padding, and reclaim its bottom Spacing.xl so the
  // list ends just above the safe area (no big dead gap under the last row, Wyoming).
  list: { flex: 1, marginHorizontal: -Spacing.xl + 2, marginBottom: -Spacing.xl },
  listContent: { paddingHorizontal: Spacing.xl - 2, gap: 6 },
  row: {
    height: 52, borderRadius: 13, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowSel: { backgroundColor: 'rgba(255,0,122,0.12)', borderColor: Colors.accentSolid },
  rowName: { fontFamily: Typography.fonts.bodySemi, fontSize: 16, color: Colors.textPrimary },
  rowNameSel: { color: Colors.accentSolid },
  empty: { fontFamily: Typography.fonts.body, fontSize: 14, color: Colors.textTertiary, textAlign: 'center', padding: Spacing.xl },
});
