// Age helpers shared by the app (the onboarding + FinancialContext birthday pickers) and, at the
// schema-v2 cutover, the `analyze` edge function (which will derive the bracket from the stored
// `dob` at runtime instead of reading a persisted bracket). Framework-agnostic — no RN/Deno imports.
// The bracket set matches the `ageBracket` enum in @shared/schemas.

export const AGE_BRACKETS = ['18-24', '25-29', '30-34', '35-44', '45+'] as const;
export type AgeBracket = (typeof AGE_BRACKETS)[number];

const BRACKET_MID_AGE: Record<AgeBracket, number> = { '18-24': 21, '25-29': 27, '30-34': 32, '35-44': 40, '45+': 50 };

/** Whole-years age from a date of birth, as of `now` (defaults to today; pass a fixed date in tests). */
export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function bracketForAge(age: number): AgeBracket {
  if (age < 25) return '18-24';
  if (age < 30) return '25-29';
  if (age < 35) return '30-34';
  if (age < 45) return '35-44';
  return '45+';
}

/** The call the roast path uses: DOB → the age bracket sent to `analyze`. */
export function ageBracketFromDob(dob: Date, now: Date = new Date()): AgeBracket {
  return bracketForAge(ageFromDob(dob, now));
}

/** Pre-position a birthday wheel at a bracket's midpoint, when only a coarse bracket is known. */
export function bracketMidpointDob(bracket: string | undefined, now: Date = new Date()): Date {
  const age = BRACKET_MID_AGE[(bracket ?? '') as AgeBracket] ?? 25;
  return new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
}

/** Display label for a bracket (en-dash; "45+" as-is). */
export function ageBracketLabel(b: string): string {
  return b === '45+' ? '45+' : b.replace('-', '–');
}

// ─── Minimum age (18+) ───
export const MIN_AGE = 18;

/** True when the DOB makes the user at least MIN_AGE. */
export function isAdult(dob: Date, now: Date = new Date()): boolean {
  return ageFromDob(dob, now) >= MIN_AGE;
}

/** The latest DOB that still satisfies MIN_AGE — use as a picker's `maximumDate` so an under-18
 *  date can't even be selected (strict, input-level enforcement). */
export function latestAdultDob(now: Date = new Date()): Date {
  return new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
}
