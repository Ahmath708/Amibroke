// Shared formatters — keep currency/date formatting consistent across the app
// (these were re-implemented identically in several screens).

/** Whole-dollar money with thousands separators, e.g. "$4,000" · "$1,234". The single money
 *  formatter app-wide — always comma-grouped (en-US) for readability; pass `decimals` for cents. */
export function formatCurrency(n: number, decimals = 0): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/** Short date, e.g. "Jun 3". */
export function formatShortDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Long date, e.g. "June 3, 2026". */
export function formatLongDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
