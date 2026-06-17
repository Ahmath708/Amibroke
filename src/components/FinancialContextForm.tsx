import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OptionChip from '@/components/OptionChip';
import { Colors, Typography, Spacing } from '@/theme/colors';
import StateSelect from '@/components/StateSelect';
import DobField from '@/components/DobField';
import MoneyInput from '@/components/MoneyInput';
import { ageBracketFromDob, bracketMidpointDob, ageBracketLabel } from '@shared/age';

// Keys match the analyze `userContext` shape; `col` is the financial_context column (schema-v2:
// demographics moved off `profiles`). The `ageBracket` field is special — it stores the raw `dob`
// DATE and the bracket is DERIVED (see valuesFromContext / contextUpdateFromValues).
export const CONTEXT_FIELDS: { key: string; label: string; col: string; options: string[] }[] = [
  { key: 'state', label: 'State', col: 'state', options: [] }, // rendered via StateSelect (all 50 + DC)
  { key: 'incomeBracket', label: 'Monthly Income', col: 'income_bracket', options: ['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k'] },
  { key: 'ageBracket', label: 'Age', col: 'dob', options: ['18-24', '25-29', '30-34', '35-44', '45+'] },
  { key: 'livingSituation', label: 'Housing', col: 'living_situation', options: ['renting', 'owning', 'with_family', 'dorm', 'other'] },
  { key: 'employmentStatus', label: 'Employment', col: 'employment_status', options: ['full_time', 'part_time', 'self_employed', 'student', 'between_jobs'] },
  { key: 'debtBracket', label: 'Total Debt', col: 'debt_bracket', options: ['none', 'under_5k', '5k_15k', '15k_50k', 'over_50k'] },
  { key: 'liquidSavingsBracket', label: 'Savings', col: 'liquid_savings_bracket', options: ['none', 'under_500', '500_2k', '2k_10k', '10k_50k', 'over_50k'] },
];

export type ContextValues = Record<string, string>;

// Optional exact monthly income (profiles.monthly_income, 00021) → a positive number, and the
// bracket it falls in. Mirrors onboarding so the input behaves identically. Held in the form's
// values under the `incomeExact` key (a string), separate from the ctx_* bracket columns.
export const parseIncome = (s?: string): number | null => {
  const n = parseFloat((s ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const incomeBracketFor = (n: number): string =>
  n < 2000 ? 'under_2k' : n < 4000 ? '2k_4k' : n < 6000 ? '4k_6k' : n < 10000 ? '6k_10k' : 'over_10k';

/** Keep the income bracket in lockstep with the exact amount when one's entered (used on load + on
 *  blur), so a stale/stored bracket never shows next to a different exact income. No exact → as-is. */
export function syncIncomeBracket(v: ContextValues): ContextValues {
  const n = parseIncome(v.incomeExact);
  return n != null ? { ...v, incomeBracket: incomeBracketFor(n) } : v;
}

// Age is collected via the DOB picker and stored as the raw `dob` DATE (financial_context.dob);
// the coarse ageBracket is DERIVED for display + the analyze input (@shared/age).

/** financial_context row → form values (keyed like the analyze userContext). dob → derived ageBracket. */
export function valuesFromContext(row: Record<string, unknown> | null): ContextValues {
  const v: ContextValues = {};
  if (!row) return v;
  for (const f of CONTEXT_FIELDS) {
    if (f.key === 'ageBracket') {
      const dob = row.dob;
      if (typeof dob === 'string' && dob) { v.dob = dob; v.ageBracket = ageBracketFromDob(new Date(dob)); }
      continue;
    }
    const val = row[f.col];
    if (typeof val === 'string' && val) v[f.key] = val;
  }
  return v;
}

/** form values → financial_context update object (only non-empty). ageBracket → raw `dob`. The exact
 *  monthly income goes to the SNAPSHOT (stated) — written separately by the screen, not here. */
export function contextUpdateFromValues(values: ContextValues): Record<string, string | null> {
  const update: Record<string, string | null> = {};
  for (const f of CONTEXT_FIELDS) {
    if (f.key === 'ageBracket') { update.dob = values.dob || null; continue; }
    update[f.col] = values[f.key] || null;
  }
  // An exact income (optional) pins the income bracket so the two stay consistent (mirrors onboarding).
  const exact = parseIncome(values.incomeExact);
  if (exact != null) update.income_bracket = incomeBracketFor(exact);
  return update;
}

// Human label: money ranges get $ + en-dash; categorical → Title Case.
export function labelFor(opt: string): string {
  if (opt === 'none') return 'None';
  const money = (t: string) => `$${t}`;
  if (opt.startsWith('under_')) return `Under ${money(opt.slice(6))}`;
  if (opt.startsWith('over_')) return `${money(opt.slice(5))}+`;
  const parts = opt.split('_');
  if (parts.length === 2 && /^[0-9]/.test(parts[0])) return `${money(parts[0])}–${money(parts[1])}`;
  return opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  /** Controlled form values (lifted to the screen so it owns dirty-tracking + the sticky Save). */
  values: ContextValues;
  onChange: (values: ContextValues) => void;
  /** Restrict to these field keys (e.g. Life Context = state/birthday/housing/employment, no money). */
  only?: string[];
}

// DOB is a calendar date (no time/zone). Parse + format with LOCAL components so it never shifts a
// day across the UTC boundary: `new Date("2001-06-14")` is UTC-midnight → renders as the 13th in any
// timezone behind UTC. Keep it June 14 by building/reading from local Y-M-D directly.
function ymdToLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function dateToYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FinancialContextForm({ values, onChange, only }: Props) {
  // DOB is held in `values.dob` (YYYY-MM-DD); derive the Date the picker needs.
  const dob = values.dob ? ymdToLocalDate(values.dob) : null;
  const set = (patch: ContextValues) => onChange({ ...values, ...patch });
  const handleDob = (date: Date) => set({ ageBracket: ageBracketFromDob(date), dob: dateToYmd(date) });
  const fields = only ? CONTEXT_FIELDS.filter((f) => only.includes(f.key)) : CONTEXT_FIELDS;

  return (
    <>
      {fields.map((field, idx) => (
        <View key={field.key} style={[styles.field, idx === fields.length - 1 && styles.fieldLast]}>
          {/* state + birthday self-label via PickerField; only chip groups need a section label */}
          {field.key !== 'state' && field.key !== 'ageBracket' && (
            <Text style={styles.fieldLabel}>{field.label}</Text>
          )}
          {field.key === 'state' ? (
            <StateSelect
              value={values.state ?? ''}
              onChange={(code) => set({ state: code })}
            />
          ) : field.key === 'ageBracket' ? (
            <DobField
              value={dob}
              onChange={handleDob}
              defaultDate={bracketMidpointDob(values.ageBracket)}
              placeholder={values.ageBracket ? `Ages ${ageBracketLabel(values.ageBracket)} · tap to set your birthday` : 'Select your birthday'}
            />
          ) : (
            <View style={styles.chipsRow}>
              {field.options.map((opt) => {
                const active = values[field.key] === opt;
                return (
                  <OptionChip
                    key={opt}
                    label={labelFor(opt)}
                    active={active}
                    onPress={() => set({ [field.key]: active ? '' : opt })}
                  />
                );
              })}
            </View>
          )}
          {field.key === 'incomeBracket' && (
            <View style={styles.exactWrap}>
              <Text style={styles.exactLabel}>Or enter exact (optional)</Text>
              <MoneyInput
                value={values.incomeExact ?? ''}
                onChangeValue={(v) => set({ incomeExact: v })}
                onBlur={() => onChange(syncIncomeBracket(values))}
              />
            </View>
          )}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: Spacing.xl + Spacing.xs }, // a touch more air between fields
  fieldLast: { marginBottom: 0 }, // no trailing gap below the last field (no empty scroll-rest)
  fieldLabel: {
    fontFamily: Typography.fonts.bodySemi, fontSize: 12, color: Colors.textTertiary,
    letterSpacing: 0.2, marginBottom: 13,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  exactWrap: { marginTop: Spacing.md },
  exactLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, marginBottom: Spacing.sm },
});
