// ─── Cinematic Honesty × iOS HIG Design System ───────────────────────────────
//
// Colors are sourced from a swappable brand palette (see src/theme/palettes/).
// Brand pole is selected here (neon today; `warm` added in redesign Phase 5);
// within "neon" the signature accent is swappable via palettes/accents.ts
// (default magenta; preview others with EXPO_PUBLIC_NEON_ACCENT=lime|cyan).
// Typography / Spacing / Radius below are palette-independent.

import { neonPalette } from './palettes/neon';

export type { Palette } from './palettes/neon';

// Brand-pole selector. The `warm` palette is authored in Phase 5; until then
// every pole resolves to neon.
export const Colors = neonPalette;

// ── iOS Typography Scale ──────────────────────────────────────────────────────
export const Typography = {
  // Claude Design type system: Geist (everything) + Geist Mono (numbers, money,
  // the score, spec labels). Weight roles map 1:1 to the old Space Grotesk / Inter
  // roles so every existing `Typography.fonts.*` reference keeps its weight.
  fonts: {
    heading: 'Geist_700Bold',
    headingSemi: 'Geist_600SemiBold',
    headingMed: 'Geist_500Medium',
    body: 'Geist_400Regular',
    bodyMed: 'Geist_500Medium',
    bodySemi: 'Geist_600SemiBold',
    // New roles for the Claude system:
    extrabold: 'Geist_800ExtraBold', // oversized hero headlines / screen titles
    mono: 'GeistMono_500Medium', // numbers, money figures
    monoSemi: 'GeistMono_600SemiBold', // the score, emphasized figures
  },
  // iOS HIG sizes
  largeTitle:  { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1:      { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2:      { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3:      { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38 },
  headline:    { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
  body:        { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41 },
  callout:     { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 },
  subhead:     { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  footnote:    { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption1:    { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  caption2:    { fontSize: 11, fontWeight: '400' as const, letterSpacing: 0.06 },
  // Expressive redesign headers — oversized + TIGHT negative tracking (the Gen-Z
  // "hyper-bold anchor" look), deliberately distinct from the iOS-default positive
  // tracking above. Use as the one dominant headline per screen.
  screenTitle: { fontSize: 36, fontWeight: '700' as const, letterSpacing: -1.4, lineHeight: 38 },
};

// ── iOS Spacing ───────────────────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,   // standard iOS margin
  xl:  20,   // content inset
  xxl: 24,
  rowHeight: 44,   // min iOS touch target
  rowHeightLg: 56,
};

// ── Radius ────────────────────────────────────────────────────────────────────
export const Radius = {
  xs:   4,
  sm:   8,
  md:   10,   // iOS grouped cell
  lg:   14,   // iOS grouped section
  xl:   16,
  xxl:  20,
  pill: 999,
};

// ── Tier palette ────────────────────────────────────────────────────────────────
// One color per subscription tier. Deliberately steers clear of the score-band
// palette (red→green) so "tier" never reads as "financial health" to the user.
export const TierColors = {
  free:        Colors.textSecondary,  // neutral gray
  action_plan: Colors.secondary,      // neon cyan
  deep_dive:   Colors.accent,        // electric purple
} as const;
