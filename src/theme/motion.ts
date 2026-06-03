// ─── Motion tokens ─────────────────────────────────────────────────────────
// The motion foundation layer, adapted from the ECC `motion-foundations` skill
// (web/motion-react) to React Native + Reanimated 4.
//
// Principle (from the skill): motion must GUIDE ATTENTION, COMMUNICATE STATE, or
// PRESERVE SPATIAL CONTINUITY — otherwise remove it. Responsiveness outranks
// smoothness. Reduced-motion overrides everything (see components/motion).
//
// Rules for this codebase:
//  • Durations/easings come from here — no inline ms/bezier in components.
//  • Spring configs come from `Springs` — no inline stiffness/damping.
//  • Animate transform/opacity only; never animate layout props (width/top/…).

import { Easing } from 'react-native-reanimated';
import type { WithSpringConfig } from 'react-native-reanimated';

/** Durations in MILLISECONDS (Reanimated uses ms; the source skill used seconds). */
export const Durations = {
  instant: 80, // tooltip/focus ring/badge
  fast: 180, // button feedback, icon swap, chip toggle
  normal: 350, // modal open, card expand, element enter
  slow: 600, // hero entrance, full-page transition
  crawl: 1000, // deliberate storytelling — sparingly
  reveal: 1500, // the score count-up payoff — intentionally long (see brief Part 3)
} as const;

// Types are inferred (bezier → EasingFunctionFactory, linear → EasingFunction);
// both are accepted by withTiming's `easing` option.
export const Easings = {
  smooth: Easing.bezier(0.22, 1, 0.36, 1), // ease-out — entrances + count-up (decelerates into rest)
  sharp: Easing.bezier(0.4, 0, 0.2, 1), // standard in/out
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1), // playful overshoot
  linear: Easing.linear,
};

/** Travel distances for enter/exit translate, in px. */
export const Distance = { xs: 4, sm: 8, md: 16, lg: 24, xl: 48 } as const;

/** Scale factors for press/hover-equivalents. press=0.96 per make-interfaces-feel-better. */
export const Scale = { subtle: 0.98, press: 0.96, pop: 1.04 } as const;

// ── Spring presets (withSpring configs) ──
// snappy=default UI · gentle=cards/panels landing · bouncy=playful · instant=popovers
// · release=drag/overshoot-settle (used by the score-reveal landing).
export const Springs = {
  snappy: { stiffness: 300, damping: 30, mass: 1 },
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  bouncy: { stiffness: 400, damping: 10, mass: 1 },
  instant: { stiffness: 600, damping: 35, mass: 1 },
  release: { stiffness: 200, damping: 20, mass: 1 },
} satisfies Record<string, WithSpringConfig>;

export type SpringName = keyof typeof Springs;

/** Default stagger between sibling entrances (ms). 40–80ms reads as a cascade. */
export const STAGGER_MS = 60;
