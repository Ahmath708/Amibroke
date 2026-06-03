// Standardized entrance/exit animations built on the motion tokens. Reanimated
// layout animations run on the UI thread and (via ReduceMotion.System) auto-honor
// the OS Reduce-Motion setting — disabling the transform travel while keeping a
// safe fade. Exits are shorter/quieter than entrances (make-interfaces-feel-better).

import { FadeIn, FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Durations, STAGGER_MS } from '@/theme/motion';

/**
 * Staggered "rise + fade" entrance. Pass the item's index so siblings cascade.
 * Use on list items, the spending-breakdown cards, roast lines, etc.
 */
export const enterUp = (index = 0) =>
  FadeInDown.delay(index * STAGGER_MS)
    .duration(Durations.normal)
    .reduceMotion(ReduceMotion.System);

/** Plain fade-in for hero/standalone elements. */
export const fadeIn = (index = 0) =>
  FadeIn.delay(index * STAGGER_MS)
    .duration(Durations.normal)
    .reduceMotion(ReduceMotion.System);

/** Quieter, shorter exit. */
export const fadeOut = () => FadeOut.duration(Durations.fast).reduceMotion(ReduceMotion.System);
