// ─── Neon palette ──────────────────────────────────────────────────────────
// The "disciplined neon" brand pole: ONE signature accent (swappable via
// palettes/accents.ts) on a dark, lifted-off-black field. Demotes the former
// three-neon system (purple + cyan + pink competing) down to a single hero
// accent + neutral/semantic supporting colors — the core "stop looking
// vibe-coded" fix.
//
// Shape is a superset of the legacy Colors object, so every existing
// `Colors.*` reference keeps working. New code should prefer the semantic
// `accent*` roles over the legacy `primary*` aliases.

import { resolveAccent } from './accents';

const A = resolveAccent();

export const neonPalette = {
  // ── Backgrounds (Claude Design: neutral near-black canvas + lifted surfaces) ──
  background: '#0B0B0F', // canvas
  backgroundSecondary: '#16161F', // card
  backgroundTertiary: '#1C1C24', // raised
  groupedBackground: '#08080B', // grouped canvas (a touch under the card field)
  groupedRow: '#16161F', // grouped row = card

  // ── Surfaces / Glass ──
  surface: 'rgba(22, 22, 31, 0.72)', // card-tinted
  surfaceElevated: 'rgba(28, 28, 36, 0.85)', // raised-tinted
  glassBackground: 'rgba(22, 22, 31, 0.60)',
  glassBorder: 'rgba(255, 255, 255, 0.08)', // hairline
  glassBorderLight: 'rgba(255, 255, 255, 0.14)',

  // ── Separators ──
  separator: 'rgba(255, 255, 255, 0.08)', // hairline

  // ── Labels (Claude ink hierarchy: white → 50% → 30%) ──
  textPrimary: '#FFFFFF', // label
  textSecondary: 'rgba(255, 255, 255, 0.50)', // muted
  textTertiary: 'rgba(255, 255, 255, 0.30)', // faint
  textMuted: 'rgba(255, 255, 255, 0.30)', // faint
  textInverse: '#0B0B0F',

  // ── Signature accent (semantic roles — swap the ramp, not these) ──
  accent: A.tint,
  accentSolid: A.solid,
  accentContainer: A.container,
  accentBorder: A.border,
  onAccent: A.on,

  // Demoted: no longer co-equal brand neons. Kept as muted/semantic supports.
  secondary: '#6AA6FF', // info-blue (Claude "info / savings")
  tertiary: A.tint, // collapse the old hot-pink role into the accent family
  tertiaryContainer: A.container,
  tertiarySolid: A.solid,

  // ── Semantic status (Claude status palette — meaning, not brand) ──
  success: '#3DDC97', // positive / income
  successContainer: 'rgba(61, 220, 151, 0.14)',
  warning: '#FFB020', // amber
  warningContainer: 'rgba(255, 176, 32, 0.14)',
  caution: '#FFB020', // confidence-medium — amber
  danger: '#FF5470', // alert / debt
  dangerContainer: 'rgba(255, 84, 112, 0.16)',
  info: '#6AA6FF', // info / savings
  infoContainer: 'rgba(106, 166, 255, 0.16)',

  // ── Gradients ──
  gradientPrimary: [A.gradient[0], A.gradient[1]] as [string, string],
};

export type Palette = typeof neonPalette;
