import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, Pressable,
} from 'react-native';
import { PressableScale } from '@/components/motion';
import AppTextInput from '@/components/AppTextInput';
import { ChevronDownIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
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
}

export default function StateSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = US_STATES.find((s) => s.code === value);

  const results = useMemo(() => {
    return US_STATES
      .map((s) => ({ s, score: scoreState(query, s) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
      .map((r) => r.s);
  }, [query]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <PressableScale style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldText, !selected && styles.placeholder]}>
          {selected ? `${selected.name} (${selected.code})` : 'Select your state'}
        </Text>
        <ChevronDownIcon size={18} color={Colors.textSecondary} />
      </PressableScale>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.searchRow}>
            <MagnifyingGlassIcon size={18} color={Colors.textMuted} />
            <AppTextInput
              style={styles.searchInput}
              placeholder="Search state or code…"
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <PressableScale onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cancel}>Cancel</Text>
            </PressableScale>
          </View>
          <FlatList
            data={results}
            keyExtractor={(s) => s.code}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>No match — check the spelling.</Text>}
            renderItem={({ item }) => (
              <PressableScale style={styles.row} onPress={() => choose(item.code)}>
                <Text style={styles.rowName}>{item.name} ({item.code})</Text>
              </PressableScale>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.groupedRow, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
  },
  fieldText: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  placeholder: { color: Colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: '12%',
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.md,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  searchInput: { flex: 1, fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, paddingVertical: Spacing.xs },
  cancel: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.accent },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  rowName: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.textPrimary },
  empty: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textMuted, textAlign: 'center', padding: Spacing.xl },
});
