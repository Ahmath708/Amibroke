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
  fonts: {
    heading: 'SpaceGrotesk_700Bold',
    headingSemi: 'SpaceGrotesk_600SemiBold',
    headingMed: 'SpaceGrotesk_500Medium',
    body: 'Inter_400Regular',
    bodyMed: 'Inter_500Medium',
    bodySemi: 'Inter_600SemiBold',
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
  // Additional screen-specific sizes
  hero:        { fontSize: 42, fontWeight: '700' as const },
  heroSmall:   { fontSize: 32, fontWeight: '700' as const },
  heroLarge:   { fontSize: 56, fontWeight: '700' as const },
  display:     { fontSize: 72, fontWeight: '700' as const, letterSpacing: -3 },
  stepTitle:   { fontSize: 26, fontWeight: '700' as const },
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
  section: 35,
  rowHeight: 44,   // min iOS touch target
  rowHeightLg: 56,
  tabBarHeight: 49,
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
  deep_dive:   Colors.primary,        // electric purple
} as const;
