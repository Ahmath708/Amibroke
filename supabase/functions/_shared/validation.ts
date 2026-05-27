export const VALID_TONES = new Set(['savage', 'gentle', 'therapist', 'older_sibling', 'finance_bro']);

export function truncate(s: unknown, max: number): string {
  return typeof s === 'string' && s.length > max ? s.slice(0, max) : String(s ?? '');
}

export function sanitizeString(obj: any, key: string, max: number): void {
  if (obj[key]) obj[key] = truncate(obj[key], max);
}
