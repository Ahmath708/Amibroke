import { getScoreBand } from '@shared/scoring/bands.ts';

/** Lighten a #RRGGBB hex toward white by `amount` (0–1). */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, '0')}`;
}

/**
 * Band-derived 2-stop gradient for score rings: the canonical band color → a
 * lighter tint of itself. The color comes from getScoreBand (the single source of
 * truth); the gradient is purely a derived shade, so there's nothing extra to keep
 * in sync. Used by ScoreRing and the History entry rings.
 */
export function scoreGradient(score: number): [string, string] {
  const base = getScoreBand(score).color;
  return [base, lighten(base, 0.45)];
}
