import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SelectableChip from '@/components/SelectableChip';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import StateSelect from '@/components/StateSelect';
import DobField from '@/components/DobField';
import MoneyInput from '@/components/MoneyInput';
import { ageBracketFromDob, bracketMidpointDob, ageBracketLabel } from '@shared/age';

// Keys match the analyze `userContext` shape; `col` is the profiles column.
export const CONTEXT_FIELDS: { key: string; label: string; col: string; options: string[] }[] = [
  { key: 'state', label: 'State', col: 'ctx_state', options: [] }, // rendered via StateSelect (all 50 + DC)
  { key: 'incomeBracket', label: 'Monthly Income', col: 'ctx_income_bracket', options: ['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k'] },
  { key: 'ageBracket', label: 'Age', col: 'ctx_age_bracket', options: ['18-24', '25-29', '30-34', '35-44', '45+'] },
  { key: 'livingSituation', label: 'Housing', col: 'ctx_living_situation', options: ['renting', 'owning', 'with_family', 'dorm', 'other'] },
  { key: 'employmentStatus', label: 'Employment', col: 'ctx_employment_status', options: ['full_time', 'part_time', 'self_employed', 'student', 'between_jobs'] },
  { key: 'debtBracket', label: 'Total Debt', col: 'ctx_debt_bracket', options: ['none', 'under_5k', '5k_15k', '15k_50k', 'over_50k'] },
  { key: 'liquidSavingsBracket', label: 'Savings', col: 'ctx_liquid_savings_bracket', options: ['none', 'under_500', '500_2k', '2k_10k', '10k_50k', 'over_50k'] },
];

export type ContextValues = Record<string, string>;

// profiles columns to SELECT when loading saved context.
export const CTX_COLUMNS = CONTEXT_FIELDS.map((f) => f.col).join(', ');

// Optional exact monthly income (profiles.monthly_income, 00021) → a positive number, and the
// bracket it falls in. Mirrors onboarding so the input behaves identically. Held in the form's
// values under the `incomeExact` key (a string), separate from the ctx_* bracket columns.
export const parseIncome = (s?: string): number | null => {
  const n = parseFloat((s ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const incomeBracketFor = (n: number): string =>
  n < 2000 ? 'under_2k' : n < 4000 ? '2k_4k' : n < 6000 ? '4k_6k' : n < 10000 ? '6k_10k' : 'over_10k';

// Age (ctx_age_bracket) is collected via the DOB picker but stored as a coarse bracket until
// schema-v2 adds a real `dob DATE` column — the derivation lives in @shared/age.

/** profiles row → form values (keyed like the analyze userContext). */
export function valuesFromProfile(row: Record<string, unknown> | null): ContextValues {
  const v: ContextValues = {};
  if (!row) return v;
  for (const f of CONTEXT_FIELDS) {
    const val = row[f.col];
    if (typeof val === 'string' && val) v[f.key] = val;
  }
  return v;
}

/** form values → profiles ctx_* update object (only non-empty). NOTE: the numeric
 *  `monthly_income` column is written separately by the screen (non-fatal, per the DB-lag gotcha). */
export function profileUpdateFromValues(values: ContextValues): Record<string, string | null> {
  const update: Record<string, string | null> = {};
  for (const f of CONTEXT_FIELDS) {
    update[f.col] = values[f.key] || null;
  }
  // An exact income (optional) pins the income bracket so the two stay consistent (mirrors onboarding).
  const exact = parseIncome(values.incomeExact);
  if (exact != null) update.ctx_income_bracket = incomeBracketFor(exact);
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

export default function FinancialContextForm({ initial = {}, submitLabel, submitting, onSubmit, onSkip, skipLabel }: Props) {
  const [selections, setSelections] = useState<ContextValues>(initial);
  // Real DOB picked this session (null until they touch the wheel). selections.ageBracket already
  // holds any previously-stored bracket, so leaving it untouched preserves it on submit.
  const [dob, setDob] = useState<Date | null>(null);
  const handleDob = (date: Date) => {
    setDob(date);
    setSelections((prev) => ({ ...prev, ageBracket: ageBracketFromDob(date) }));
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
        <TouchableOpacity onPress={onSkip} disabled={submitting} style={styles.skipBtn} activeOpacity={0.7}>
          <Text style={styles.skipText}>{skipLabel ?? 'Skip for now'}</Text>
        </TouchableOpacity>
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
