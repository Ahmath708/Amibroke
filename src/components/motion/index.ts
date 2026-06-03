// Motion system — the "alive" toolkit. Built on src/theme/motion.ts tokens and
// translated from the ECC motion-foundations skill to Reanimated 4.
//
//   import { PressableScale, CountUp, enterUp } from '@/components/motion';
//
// Reduce-motion: PressableScale/CountUp use Reanimated's useReducedMotion; the
// entrance builders use ReduceMotion.System. Always prefer these over hand-rolled
// Animated so the accessibility gate is never forgotten.

export { PressableScale } from './PressableScale';
export { CountUp } from './CountUp';
export { enterUp, fadeIn, fadeOut } from './entrances';
export { useReducedMotion } from 'react-native-reanimated';
