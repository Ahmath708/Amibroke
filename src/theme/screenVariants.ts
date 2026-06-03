// ─── Screen background variants ──────────────────────────────────────────────
// Token-driven backgrounds for ScreenBackground (extracted from ~185 hardcoded
// hex values originally inline in the component).
//
// Design decision (researched 2026-06-03): NO ambient drifting "orbs". Global,
// dual, drifting gradient blobs are a recognized "vibe-coded"/AI-slop tell —
// purposeless decoration behind every screen. Premium dark apps (Apple HIG,
// Material, Linear) build depth from a flat near-black field + layered/elevated
// SURFACES, and reserve a single restrained glow for the focal element. So each
// screen is a confident flat dark field; brand screens share the neutral base,
// semantic screens get a faint state tint. The one allowed glow lives ON the
// ScoreRing (the brand/focal moment), not in the global background.

import { Colors } from './colors';

export type ScreenVariant =
  | 'home' | 'results' | 'profile' | 'settings'
  | 'history' | 'community' | 'paywall' | 'processing'
  | 'onboarding' | 'login' | 'splash' | 'share'
  | 'subscriptions' | 'scenarios' | 'debt'
  | 'actionPlan' | 'creator' | 'checkin' | 'info';

// Kept for a future single, anchored glow (e.g. behind the score) — intentionally
// unused by the global background now.
export type OrbSpec = {
  colors: [string, string];
  size: number;
  top?: number; bottom?: number; left?: number; right?: number;
};
export type VariantTheme = { gradient: [string, string]; orbs?: OrbSpec[] };

type Role = 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

// Subtle dark fields. Brand/neutral/warning share the base; semantic roles carry
// a faint deep tint that *communicates state* (a purpose), not decoration.
const base: Record<Role, [string, string]> = {
  accent: [Colors.groupedBackground, Colors.background],
  neutral: [Colors.groupedBackground, Colors.background],
  warning: [Colors.groupedBackground, Colors.background],
  info: ['#0b1419', Colors.background],
  success: ['#0b1410', Colors.background],
  danger: ['#170c0e', Colors.background],
};

const ROLE: Record<ScreenVariant, Role> = {
  home: 'accent', results: 'accent', profile: 'accent', settings: 'neutral',
  history: 'info', community: 'accent', paywall: 'warning', processing: 'accent',
  onboarding: 'accent', login: 'accent', splash: 'accent', share: 'accent',
  subscriptions: 'warning', scenarios: 'info', debt: 'danger', actionPlan: 'success',
  creator: 'accent', checkin: 'accent', info: 'neutral',
};

export const SCREEN_VARIANTS = Object.fromEntries(
  (Object.keys(ROLE) as ScreenVariant[]).map((v) => [v, { gradient: base[ROLE[v]] }]),
) as Record<ScreenVariant, VariantTheme>;
