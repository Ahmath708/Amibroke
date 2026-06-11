import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion';
import SelectableChip from '@/components/SelectableChip';
import { Colors, Typography, Spacing } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
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
  initial?: ContextValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: ContextValues) => void;
  onSkip?: () => void;
  skipLabel?: string;
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

export default function FinancialContextForm({ initial = {}, submitLabel, submitting, onSubmit, onSkip, skipLabel }: Props) {
  const [selections, setSelections] = useState<ContextValues>(initial);
  // Seed the picker from the saved financial_context.dob so Birthday prefills the actual date
  // (not just the derived bracket placeholder). Null only when no DOB has ever been set.
  const [dob, setDob] = useState<Date | null>(() => (initial.dob ? ymdToLocalDate(initial.dob) : null));
  const handleDob = (date: Date) => {
    setDob(date);
    setSelections((prev) => ({ ...prev, ageBracket: ageBracketFromDob(date), dob: dateToYmd(date) }));
  };

  return (
    <>
      {CONTEXT_FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{field.key === 'ageBracket' ? 'Birthday' : field.label}</Text>
          {field.key === 'state' ? (
            <StateSelect
              value={selections.state ?? ''}
              onChange={(code) => setSelections((prev) => ({ ...prev, state: code }))}
            />
          ) : field.key === 'ageBracket' ? (
            <DobField
              value={dob}
              onChange={handleDob}
              defaultDate={bracketMidpointDob(selections.ageBracket)}
              placeholder={selections.ageBracket ? `Ages ${ageBracketLabel(selections.ageBracket)} · tap to set your birthday` : 'Select your birthday'}
            />
          ) : (
            <View style={styles.chipsRow}>
              {field.options.map((opt) => {
                const active = selections[field.key] === opt;
                return (
                  <SelectableChip
                    key={opt}
                    label={labelFor(opt)}
                    active={active}
                    onPress={() => setSelections((prev) => ({ ...prev, [field.key]: active ? '' : opt }))}
                  />
                );
              })}
            </View>
          )}
          {field.key === 'incomeBracket' && (
            <View style={styles.exactWrap}>
              <Text style={styles.exactLabel}>Or enter exact (optional)</Text>
              <MoneyInput
                value={selections.incomeExact ?? ''}
                onChangeValue={(v) => setSelections((prev) => ({ ...prev, incomeExact: v }))}
              />
            </View>
          )}
        </View>
      ))}

      <NeonButton
        label={submitting ? '' : submitLabel}
        onPress={() => onSubmit(selections)}
        loading={submitting}
        style={styles.cta}
      />
      {onSkip && (
        <PressableScale onPress={onSkip} disabled={submitting} style={styles.skipBtn}>
          <Text style={styles.skipText}>{skipLabel ?? 'Skip for now'}</Text>
        </PressableScale>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: Spacing.xl + Spacing.xs }, // a touch more air between fields
  fieldLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  exactWrap: { marginTop: Spacing.md },
  exactLabel: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, marginBottom: Spacing.sm },
  cta: { marginTop: Spacing.lg },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  skipText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, textDecorationLine: 'underline' },
});
