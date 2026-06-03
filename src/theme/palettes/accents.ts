// ─── Accent ramps ────────────────────────────────────────────────────────────
// The single signature color for the "neon" brand pole. This is the React Native
// equivalent of CSS custom properties: components never hardcode the accent —
// they read semantic roles (Colors.accent / accentSolid / accentContainer /
// onAccent), and those resolve to ONE of these ramps.
//
// To preview a different accent, either:
//   • change DEFAULT_ACCENT below, or
//   • set EXPO_PUBLIC_NEON_ACCENT=lime|cyan|magenta|purple and rebuild.
//
// "Disciplined neon" = ONE of these is the hero; the others are demoted to small
// semantic-only roles (see palettes/neon.ts). Magenta is the chosen default —
// playful/irreverent, best fit for the roast voice.

export type AccentRamp = {
  name: string;
  /** Light tint — text/icons/hairlines on a dark surface (legacy `primary`). */
  tint: string;
  /** Saturated fill — CTAs, the score ring, key emphasis (legacy `primarySolid`). */
  solid: string;
  /** Low-alpha wash — chips, selected states, subtle fills (legacy `primaryContainer`). */
  container: string;
  /** Two-stop gradient for hero moments (legacy `gradientPrimary`/`gradientScore`). */
  gradient: [string, string];
  /** Text/icon color that sits ON a solid-accent fill (contrast-safe). */
  on: string;
};

export const ACCENTS = {
  // Hero default — hot magenta. Playful, irreverent, on-brand for a roast app.
  magenta: {
    name: 'magenta',
    tint: '#ff8fb8',
    solid: '#ff2d78',
    container: 'rgba(255, 45, 120, 0.20)',
    gradient: ['#ff2d78', '#e7006e'],
    on: '#ffffff',
  },
  // Bold "money" energy — Cash App / Robinhood lane.
  lime: {
    name: 'lime',
    tint: '#e6ff85',
    solid: '#c6ff00',
    container: 'rgba(198, 255, 0, 0.16)',
    gradient: ['#c6ff00', '#8fcc00'],
    on: '#0c1200',
  },
  // Cool / techy / fresh — cleanest escape from the purple cliché.
  cyan: {
    name: 'cyan',
    tint: '#b9f1ff',
    solid: '#00e0ff',
    container: 'rgba(0, 224, 255, 0.18)',
    gradient: ['#00e0ff', '#0080ff'],
    on: '#00181f',
  },
  // Legacy fallback — the original electric purple (the "AI-slop" look we're leaving).
  purple: {
    name: 'purple',
    tint: '#ecb2ff',
    solid: '#bd00ff',
    container: 'rgba(189, 0, 255, 0.22)',
    gradient: ['#bd00ff', '#e7006e'],
    on: '#ffffff',
  },
} satisfies Record<string, AccentRamp>;

export type AccentName = keyof typeof ACCENTS;

export const DEFAULT_ACCENT: AccentName = 'magenta';

/** Resolve the active accent ramp (env override → default). */
export function resolveAccent(): AccentRamp {
  const requested = process.env.EXPO_PUBLIC_NEON_ACCENT as AccentName | undefined;
  if (requested && requested in ACCENTS) return ACCENTS[requested];
  return ACCENTS[DEFAULT_ACCENT];
}
