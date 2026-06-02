// ─── Cinematic Honesty × iOS HIG Design System ───────────────────────────────

export const Colors = {
  // ── iOS System Backgrounds (dark adaptive) ──
  background:            '#19101c',   // systemBackground
  backgroundSecondary:   '#211824',   // secondarySystemBackground
  backgroundTertiary:    '#261c28',   // tertiarySystemBackground
  groupedBackground:     '#130b16',   // systemGroupedBackground
  groupedRow:            '#1e1221',   // secondarySystemGroupedBackground

  // ── Surfaces / Glass ──
  surface:               'rgba(38, 28, 40, 0.72)',
  surfaceElevated:       'rgba(50, 36, 54, 0.85)',
  glassBackground:       'rgba(38, 28, 40, 0.60)',
  glassBorder:           'rgba(255, 255, 255, 0.08)',
  glassBorderLight:      'rgba(255, 255, 255, 0.14)',

  // ── Separators ──
  separator:             'rgba(255, 255, 255, 0.10)',
  separatorOpaque:       '#2d1f30',

  // ── Labels (iOS label hierarchy) ──
  textPrimary:           '#eeddee',   // label
  textSecondary:         '#a897ab',   // secondaryLabel
  textTertiary:          '#6e5f71',   // tertiaryLabel
  textMuted:             '#4a3d4d',   // quaternaryLabel
  textInverse:           '#19101c',

  // ── Brand ──
  primary:               '#ecb2ff',   // Electric Purple
  primaryContainer:      'rgba(189, 0, 255, 0.22)',
  primarySolid:          '#bd00ff',
  secondary:             '#b9f1ff',   // Neon Cyan
  secondaryContainer:    'rgba(0, 224, 255, 0.18)',
  secondarySolid:        '#00e0ff',
  tertiary:              '#ffb1c3',   // Hot Pink
  tertiaryContainer:     'rgba(231, 0, 110, 0.22)',
  tertiarySolid:         '#e7006e',

  // ── Semantic status ──
  success:               '#39FF14',
  successContainer:      'rgba(57, 255, 20, 0.14)',
  warning:               '#FF6B00',
  warningContainer:      'rgba(255, 107, 0, 0.14)',
  caution:               '#FFCC00',   // iOS systemYellow — confidence-medium (distinct from severity's orange)
  danger:                '#ff453a',   // iOS systemRed
  dangerContainer:       'rgba(255, 69, 58, 0.16)',
  info:                  '#b9f1ff',
  infoContainer:         'rgba(185, 241, 255, 0.14)',

  // ── Tints (iOS tintColor) ──
  tint:                  '#ecb2ff',

  // ── Gradients ──
  gradientPrimary:  ['#bd00ff', '#e7006e'] as [string, string],
  gradientScore:    ['#ecb2ff', '#bd00ff'] as [string, string],
  gradientCyan:     ['#00e0ff', '#0080ff'] as [string, string],
  gradientDanger:   ['#e7006e', '#ff4500'] as [string, string],
  gradientSuccess:  ['#39FF14', '#00e0ff'] as [string, string],
  gradientDark:     ['#19101c', '#1f0a2e'] as [string, string],
};

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
