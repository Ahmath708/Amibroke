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
  // ── Backgrounds (dark, lifted off pure #000 to avoid halation) ──
  background: '#19101c', // systemBackground
  backgroundSecondary: '#211824', // secondarySystemBackground
  backgroundTertiary: '#261c28', // tertiarySystemBackground
  groupedBackground: '#130b16', // systemGroupedBackground
  groupedRow: '#1e1221', // secondarySystemGroupedBackground

  // ── Surfaces / Glass ──
  surface: 'rgba(38, 28, 40, 0.72)',
  surfaceElevated: 'rgba(50, 36, 54, 0.85)',
  glassBackground: 'rgba(38, 28, 40, 0.60)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderLight: 'rgba(255, 255, 255, 0.14)',

  // ── Separators ──
  separator: 'rgba(255, 255, 255, 0.10)',
  separatorOpaque: '#2d1f30',

  // ── Labels (iOS label hierarchy) ──
  textPrimary: '#eeddee', // label
  textSecondary: '#a897ab', // secondaryLabel
  textTertiary: '#6e5f71', // tertiaryLabel
  textMuted: '#4a3d4d', // quaternaryLabel
  textInverse: '#19101c',

  // ── Signature accent (semantic roles — swap the ramp, not these) ──
  accent: A.tint,
  accentSolid: A.solid,
  accentContainer: A.container,
  onAccent: A.on,

  // ── Brand (legacy aliases → resolve to the signature accent) ──
  primary: A.tint,
  primaryContainer: A.container,
  primarySolid: A.solid,
  // Demoted: no longer co-equal brand neons. Kept as muted/semantic supports.
  secondary: '#9fb6c2', // was neon cyan — demoted to a neutral info-blue
  secondaryContainer: 'rgba(159, 182, 194, 0.16)',
  secondarySolid: '#6f93a3',
  tertiary: A.tint, // collapse the old hot-pink role into the accent family
  tertiaryContainer: A.container,
  tertiarySolid: A.solid,

  // ── Semantic status (unchanged — these are meaning, not brand) ──
  success: '#39FF14',
  successContainer: 'rgba(57, 255, 20, 0.14)',
  warning: '#FF6B00',
  warningContainer: 'rgba(255, 107, 0, 0.14)',
  caution: '#FFCC00', // iOS systemYellow — confidence-medium
  danger: '#ff453a', // iOS systemRed
  dangerContainer: 'rgba(255, 69, 58, 0.16)',
  info: '#9fb6c2',
  infoContainer: 'rgba(159, 182, 194, 0.16)',

  // ── Tints (iOS tintColor → the signature accent) ──
  tint: A.tint,

  // ── Gradients ──
  gradientPrimary: [A.gradient[0], A.gradient[1]] as [string, string],
  gradientScore: [A.gradient[0], A.gradient[1]] as [string, string],
  gradientCyan: ['#00e0ff', '#0080ff'] as [string, string],
  gradientDanger: ['#e7006e', '#ff4500'] as [string, string],
  gradientSuccess: ['#39FF14', '#00e0ff'] as [string, string],
  gradientDark: ['#19101c', '#1f0a2e'] as [string, string],
};

export type Palette = typeof neonPalette;
